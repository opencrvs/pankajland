import {
  CauseLetter,
  symptomNumber
} from '@countryconfig/events/death/forms/pages/causeOfDeathDetails'
import { EventDocument, getAcceptedActions } from '@opencrvs/toolkit/events'

export async function getAccessToken(
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

const causeLetters: CauseLetter[] = ['A', 'B', 'C', 'D', 'E', 'Other']

const nonPIIFields = [
  'deceased.address',
  'deceased.dob',
  'eventDetails.date',
  'deceased.gender'
]

// Add dynamic causeOfDeathDetails fields based on cause letters and symptom keys, to nonPIIFields array:
for (const letter of causeLetters) {
  nonPIIFields.push(`causeOfDeathDetails.causeOfDeath${letter}.interval`)

  for (const symptom of symptomNumber) {
    nonPIIFields.push(
      `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}`
    )
    nonPIIFields.push(
      `causeOfDeathDetails.causeOfDeath${letter}.symptom.${symptom}.other`
    )
  }
}

export function getSpcCompatibleEventDocument(event: EventDocument) {
  const acceptedActions = getAcceptedActions(event)

  const declareAction = acceptedActions.find(
    (action) => action.type === 'DECLARE'
  )

  const declaration = declareAction?.declaration || {}

  const declarationWithoutPIIData = Object.fromEntries(
    Object.entries(declaration).filter(([key]) => nonPIIFields.includes(key))
  )

  const spcCompatibleDeclaration = remapDeclarationKeys(
    declarationWithoutPIIData
  )

  const spcCompatibleEventDocument = {
    ...event,
    actions: event.actions
      .filter((action) => action.type !== 'REGISTER')
      .map((action) => {
        if (action.type === 'DECLARE' && action.status === 'Requested') {
          return { ...action, declaration: spcCompatibleDeclaration }
        }
        return action
      })
  }

  return spcCompatibleEventDocument
}
