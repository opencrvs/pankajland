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

export async function sendRecordToSpcPortal(event: EventDocument) {
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
      body: JSON.stringify(event)
    })
    console.log('Response status from country API:', response.status)
    if (!response.ok) {
      console.error('Error response from country API:', await response.text())
    }
  } catch (error) {
    console.error('Error sending data to country API:', error)
  }
}
