import {
  SPC_AUTH_URL,
  SPC_CLIENT_ID,
  SPC_CLIENT_SECRET,
  SPC_COUNTRY_CONFIG_URL
} from '@countryconfig/constants'
import {
  CauseLetter,
  symptomNumber
} from '@countryconfig/events/death/forms/pages/causeOfDeathDetails'
import { EventDocument, FieldUpdateValue } from '@opencrvs/toolkit/events'
import { logger } from '@countryconfig/logger'
import {
  deleteRetryQueueEntryByEventId,
  upsertFailedSubmission
} from './retryQueue'
import { sendEmail } from '../notification/email-service'
import { ALERT_EMAIL, SENDER_EMAIL_ADDRESS } from '../notification/constant'
import { applicationConfig } from '../application/application-config'

type TokenResponse = { access_token: string; token_type: string }

export async function getAccessToken(
  clientId: string,
  clientSecret: string,
  countryAuthBase: string
): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID or CLIENT_SECRET not set in environment')
  }

  const url = new URL('token', countryAuthBase)

  logger.info(`Requesting access token from: ${url.toString()}`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    }),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok)
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`)

  const data = (await res.json()) as TokenResponse
  if (!data.access_token) throw new Error('Token response missing access_token')
  return data.access_token
}

// Gender mapping from OpenCRVS values to SPC COD portal expected values
const GENDER_MAP: Record<string, string> = {
  MALE: '1',
  FEMALE: '2',
  UNKNOWN: '9'
}

// Maps declaration keys to the structure expected by the SPC COD portal
// eventDetails.date -> deceased.eventDate
// causeOfDeathDetails.causeOfDeathA.interval -> eventDetails.causeOfDeathA.interval
// causeOfDeathDetails.causeOfDeathA.symptom.one -> eventDetails.causeOfDeathA.symptom.one
// ... and so on for other cause letters and symptoms
// also does a value transformation step for gender to map to the expected values in the SPC COD portal
function remapDeclarationKeys<T extends Record<string, FieldUpdateValue>>(
  obj: T
) {
  const result: Record<string, FieldUpdateValue> = {}

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

export const causeLetters: CauseLetter[] = ['A', 'B', 'C', 'D', 'E', 'Other']

const deceasedFields = [
  'deceased.address',
  'deceased.dob',
  'eventDetails.date',
  'deceased.gender'
]

export const causeOfDeathFields: string[] = []

// Add dynamic causeOfDeathDetails fields based on cause letters and symptom keys, to causeOfDeathFields array:
for (const letter of causeLetters) {
  causeOfDeathFields.push(`causeOfDeathDetails.causeOfDeath${letter}.interval`)

  for (const symptom of symptomNumber) {
    causeOfDeathFields.push(
      `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}`
    )
    causeOfDeathFields.push(
      `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}.other`
    )
  }
}

const nonPIIFields = [...deceasedFields, ...causeOfDeathFields]

export function getSpcCompatibleEventDocument(
  event: EventDocument,
  declaration: Record<string, FieldUpdateValue>
) {
  const declarationWithoutPIIData = Object.fromEntries(
    Object.entries(declaration).filter(([key]) => nonPIIFields.includes(key))
  )

  const spcCompatibleDeclaration = remapDeclarationKeys(
    declarationWithoutPIIData
  )

  const excludedActionTypes = [
    'REGISTER',
    'REQUEST_CORRECTION',
    'APPROVE_CORRECTION'
  ]

  const spcCompatibleEventDocument = {
    ...event,
    actions: event.actions
      .filter((action) => !excludedActionTypes.includes(action.type))
      .map((action) => {
        if (action.type === 'NOTIFY' && action.status === 'Requested') {
          return {
            ...action,
            declaration: spcCompatibleDeclaration
          }
        }
        if (action.type === 'DECLARE' && action.status === 'Requested') {
          return {
            ...action,
            declaration: spcCompatibleDeclaration
          }
        }
        return action
      })
  }

  return spcCompatibleEventDocument
}

export function extractCodFields(
  obj: Record<string, FieldUpdateValue>,
  fields: string[]
): Record<string, FieldUpdateValue> {
  const fieldSet = new Set(fields)

  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => fieldSet.has(key))
  )
}

export async function postSpcRecord(event: EventDocument): Promise<void> {
  const spcToken = await getAccessToken(
    SPC_CLIENT_ID || '',
    SPC_CLIENT_SECRET || '',
    SPC_AUTH_URL
  )
  const url = new URL(
    '/insert-external-record-to-encode/TUV',
    SPC_COUNTRY_CONFIG_URL
  ).toString()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${spcToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(10000)
  })

  logger.info(`Response status from country API: ${response.status}`)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Error response from country API: ${response.status} ${body}`
    )
  }
}

export async function sendRecordToSpcPortalOrEnqueue(
  event: EventDocument
): Promise<void> {
  try {
    await postSpcRecord(event)
    try {
      await deleteRetryQueueEntryByEventId(event.id)
    } catch (dbError) {
      logger.error('Failed to clear stale SPC retry queue entry', dbError)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Error sending data to country API, queueing for retry', error)

    try {
      await upsertFailedSubmission(event.id, event.trackingId, event, message)
    } catch (dbError) {
      logger.error('Failed to enqueue SPC submission for retry', dbError)
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info(
          `Would send email to admin about failed record submission to the SPC portal`
        )
        return
      }
      await sendSpcDownAlertEmail(event.trackingId)
    } catch (emailError) {
      logger.error('Failed to send SPC-down alert email', emailError)
    }
  }
}

export async function sendSpcDownAlertEmail(trackingId: string) {
  const applicationName = applicationConfig.APPLICATION_NAME || 'OpenCRVS'
  const emailBody = `
      <p>Dear admin,</p>
      <p>Pankajland failed to submit a record to the SPC portal.</p>
      <ul>
        <li>Tracking ID: ${trackingId}</li>
      </ul>
      <p>See the retry queue for details: GET /spc-coding/retry-queue</p>
      <p>Best regards,<br>${applicationName}</p>
    `
  await sendEmail({
    subject: 'SPC communication down — event failed to submit',
    from: SENDER_EMAIL_ADDRESS,
    to: ALERT_EMAIL,
    html: emailBody
  })
}
