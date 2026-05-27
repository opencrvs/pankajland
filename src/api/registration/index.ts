/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */
import * as Hapi from '@hapi/hapi'
import { generateRegistrationNumber } from './registrationNumber'
import { createClient } from '@opencrvs/toolkit/api'
import {
  ActionInput,
  EventDocument,
  getAcceptedActions,
  getPendingAction
} from '@opencrvs/toolkit/events'
import {
  GATEWAY_URL,
  SPC_CLIENT_ID,
  SPC_CLIENT_SECRET,
  SPC_COUNTRY_CONFIG_URL,
  SPC_AUTH_URL
} from '@countryconfig/constants'
import { v4 as uuidv4 } from 'uuid'
import { sendInformantNotification } from '../notification/informantNotification'

// Maps declaration keys to the structure expected by the SPC COD portal
// eventDetails.date -> deceased.eventDate
// causeOfDeathDetails.causeOfDeathA.interval -> eventDetails.causeOfDeathA.interval
// causeOfDeathDetails.causeOfDeathA.symptom.one -> eventDetails.causeOfDeathA.symptom.one
// ... and so on for other cause letters and symptoms
// also does a value transformation step for gender to map to the expected values in the SPC COD portal

const GENDER_MAP: Record<string, string> = {
  MALE: '1',
  FEMALE: '2',
  UNKNOWN: '9'
}

function remapDeclarationKeys<T extends Record<string, unknown>>(obj: T) {
  const result: Record<string, unknown> = {}

  for (const [key, originalValue] of Object.entries(obj)) {
    let newKey = key
    let value = originalValue

    // eventDetails.date -> deceased.eventDate
    if (key === 'eventDetails.date') {
      newKey = 'deceased.eventDate'
    }

    // causeOfDeathDetails.* -> eventDetails.*
    else if (key.startsWith('causeOfDeathDetails.')) {
      newKey = key.replace('causeOfDeathDetails.', 'eventDetails.')
    }

    // deceased.gender value mapping
    if (key === 'deceased.gender' && typeof value === 'string') {
      value = GENDER_MAP[value.toUpperCase()] ?? value
    }

    result[newKey] = value
  }

  return result
}

export interface ActionConfirmationRequest extends Hapi.Request {
  payload: EventDocument
}

/* eslint-disable no-unused-vars */

/**
 * Handler for event registration confirmation.
 *
 * This function is called when an event registration is initiated and demonstrates
 * how to implement an action confirmation handler for the REGISTER action type.
 *
 * Action confirmation handlers support three response patterns:
 *
 * - HTTP 200: Immediately accept the action. For registration actions, the response
 *   must include a registrationNumber in the payload: { registrationNumber: "..." }
 *
 * - HTTP 400: Immediately reject the action. The action will be marked as rejected.
 *
 * - HTTP 202: Defer the decision (asynchronous flow). The action enters a 'Requested' state
 *   until it is later explicitly accepted or rejected. When using this approach, you must
 *   store the token, actionId, eventId and action payload to use with the accept/reject API calls later.
 *
 * For registration actions specifically, when accepting asynchronously, you must provide
 * a registration number as shown in the acceptRequestedRegistration example below.
 *
 * @param {ActionConfirmationRequest} request - The request object.
 * @param {Hapi.ResponseToolkit} h - The response toolkit.
 * @returns {Hapi.Response} The response object. Should return HTTP 200, 202 or 400. With HTTP 200, the payload should contain the generated registration number.
 */

type TokenResponse = { access_token: string; token_type: string }

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  countryAuthBase: string
): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID or CLIENT_SECRET not set in environment')
  }

  const url = new URL('/token', countryAuthBase)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('grant_type', 'client_credentials')

  console.log('Requesting access token from:', url.toString())
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok)
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`)

  const data = (await res.json()) as TokenResponse
  if (!data.access_token) throw new Error('Token response missing access_token')
  return data.access_token
}

export async function onRegisterHandler(
  request: ActionConfirmationRequest,
  h: Hapi.ResponseToolkit
) {
  const token = request.auth.artifacts.token as string
  const event = request.payload
  const eventId = event.id
  const action = getPendingAction(event.actions)

  // OPTION 1: Immediate acceptance (HTTP 200)
  // Return HTTP 200 with a registration number to immediately accept the registration action.
  // This is the default implementation that automatically generates and assigns a registration number.

  type CauseLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'Other'

  const allowedPaths = [
    'deceased.address',
    'deceased.dob',
    'eventDetails.date',
    'deceased.gender'
  ]

  // Add dynamic eventDetails paths
  const causeLetters: CauseLetter[] = ['A', 'B', 'C', 'D', 'E', 'Other']
  const symptomKeys = [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight'
  ]

  for (const letter of causeLetters) {
    allowedPaths.push(`causeOfDeathDetails.causeOfDeath${letter}.interval`)

    for (const symptom of symptomKeys) {
      allowedPaths.push(
        `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}`
      )
      allowedPaths.push(
        `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}.other`
      )
    }
  }

  const registrationNumber = generateRegistrationNumber()

  if (event.type === 'death') {
    const trackingId = event.trackingId

    const acceptedActions = getAcceptedActions(event)

    const declareAction = acceptedActions.find(
      (action) => action.type === 'DECLARE'
    )

    const declaration = declareAction?.declaration || {}

    const filteredDeclaration = Object.fromEntries(
      Object.entries(declaration).filter(([key]) => allowedPaths.includes(key))
    )

    const mappedDeclaration = remapDeclarationKeys(filteredDeclaration)

    const eventPayload = {
      ...event,
      actions: event.actions
        .filter((action) => action.type !== 'REGISTER')
        .map((action) => {
          if (action.type === 'DECLARE' && action.status === 'Requested') {
            return { ...action, declaration: mappedDeclaration }
          }
          return action
        })
    }

    const spcToken = await getAccessToken(
      SPC_CLIENT_ID || '',
      SPC_CLIENT_SECRET || '',
      SPC_AUTH_URL
    )

    const url = new URL(
      '/insert-external-record-to-encode/TUV',
      SPC_COUNTRY_CONFIG_URL
    ).toString()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${spcToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      })
      console.log('Response status from country API:', response.status)
      if (!response.ok) {
        console.error('Error response from country API:', await response.text())
      }
    } catch (error) {
      console.error('Error sending data to country API:', error)
    }
  }

  await sendInformantNotification({ event, token, registrationNumber })

  // When registering deaths, we need to send IDENT and MEDCOD data to SPC COD PORTAL
  // The data should not contain any PII data.
  // Append EXTERNAL_OPENCRVS_RECORD_ prefix to the registration number so that SPC can use it to identify records from an external OCRVS system integration.
  // const spcData = removePIIData(event)
  // await sendDeathDataToSPC(spcData, token)

  return h.response({ registrationNumber }).code(200)

  // OPTION 2: Immediate rejection (HTTP 400)
  // To reject the registration immediately, uncomment the following:
  //
  // return h.response({ reason: 'Rejection reason here' }).code(400)

  // OPTION 3: Deferred decision (HTTP 202)
  // To implement an asynchronous workflow where the decision is made later:
  // 1. Store the token, eventId, actionId, and action details in your system
  // 2. Return HTTP 202 to place the action in 'Requested' state
  // 3. Later call client.event.actions.register.accept.mutate() or client.event.actions.register.reject.mutate()
  //
  // Below is example of how to defer the confirmation, accepting it after a 10 second delay
  // To defer the confirmation, uncomment the following:
  //
  // setTimeout(() => {
  //   acceptRequestedRegistration(token, eventId, actionId, action)
  // }, 10000)
  // return h.response().code(202)
}

/**
 * Example function for asynchronously accepting a registration action.
 *
 * This should only be used when an action is in 'Requested' state (after returning HTTP 202
 * for the initial confirmation request). This function demonstrates how to accept a registration
 * that was previously placed in a pending state.
 *
 * For registration actions specifically, you must provide a registration number when accepting.
 * See the Action Confirmation documentation for more details on asynchronous confirmation flows.
 */
async function acceptRequestedRegistration(
  token: string,
  eventId: string,
  actionId: string,
  action: ActionInput
) {
  const url = new URL('events', GATEWAY_URL).toString()
  const client = createClient(url, `Bearer ${token}`)

  const event = await client.event.actions.register.accept.mutate({
    ...action,
    transactionId: uuidv4(),
    eventId,
    actionId,
    registrationNumber: generateRegistrationNumber()
  })

  return event
}

/**
 * Example function for asynchronously rejecting a registration action.
 *
 * This should only be used when an action is in 'Requested' state (after returning HTTP 202
 * for the initial confirmation request). This function demonstrates how to reject a registration
 * that was previously placed in a pending state.
 */
async function rejectRequestedRegistration(
  token: string,
  eventId: string,
  actionId: string
) {
  const url = new URL('events', GATEWAY_URL).toString()
  const client = createClient(url, `Bearer ${token}`)

  const event = await client.event.actions.register.reject.mutate({
    transactionId: uuidv4(),
    eventId,
    actionId
  })

  return event
}
