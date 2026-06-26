import {
  COUNTRY_CONFIG_HOST,
  GATEWAY_URL,
  SPC_AUTH_URL,
  SPC_CLIENT_ID,
  SPC_CLIENT_SECRET,
  SPC_COUNTRY_CONFIG_URL
} from '@countryconfig/constants'
import {
  CauseLetter,
  symptomNumber
} from '@countryconfig/events/death/forms/pages/causeOfDeathDetails'
import { createClient } from '@opencrvs/toolkit/api';
import { EventDocument, FieldUpdateValue } from '@opencrvs/toolkit/events'

type TokenResponse = { access_token: string; token_type: string }

export interface ProcessingResult {
  rowIndex: number
  id: string
  status: 'success' | 'skipped' | 'error'
  message: string
  causesOfDeath?: string
  irisRejectionReason?: string
  createdBy?: string | null
  /** The tracking ID of the record for display in emails */
  trackingId?: string
}
export interface RecordsToEmail {
  status: 'success' | 'skipped' | 'error'
  /** The tracking ID of the record for display in emails */
  trackingId?: string
  /** The uc code of the record for display in emails */
  ucCode?: string
}

export interface ProcessingSummary {
  total: number
  successful: number
  skipped: number
  errors: number
  results: ProcessingResult[]
}

/**
 * User information for email notifications
 */
export interface UserInfo {
  id: string
  email: string
  firstName: string
  lastName: string
}

export async function getAccessToken(
  clientId: string,
  clientSecret: string,
  countryAuthBase: string
): Promise<string> {
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID or CLIENT_SECRET not set in environment')
  }

  const url = new URL('token', countryAuthBase)

  console.log('Requesting access token from:', url.toString())
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    })
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

/**
 * Fetch user details by user ID from OpenCRVS
 */
export async function getUserById(
  token: string,
  userId: string
): Promise<UserInfo | null> {
  const url = new URL('events', GATEWAY_URL).toString()
  const client = createClient(url, `Bearer ${token}`)

  try {
    const userOrSystem = await client.user.get.query(userId)

    if (userOrSystem.type === 'user') {
      return {
        id: userOrSystem.id || userId,
        email: userOrSystem.email || '',
        firstName: userOrSystem.name.firstname,
        lastName: userOrSystem.name.surname
      }
    }
    return null
  } catch (error) {
    return null
  }
}

/**
 * Send email notifications to users about their processed records.
 * Groups all successful records by createdBy user and sends ONE email per user
 * containing all their processed record IDs.
 */
export async function sendEmailNotifications(
  token: string,
  results: ProcessingResult[]
): Promise<void> {
  // Filter successful or rejected results that have a createdBy user
  const successfulResults = results.filter(
    (r) => r.status === 'success' && r.createdBy
  )

  if (successfulResults.length === 0) {
    return
  }

  // Group ALL records by createdBy user - one entry per user with all their records
  const recordsByUser = new Map<string, RecordsToEmail[]>()
  for (const result of successfulResults) {
    if (result.createdBy) {
      const existing = recordsByUser.get(result.createdBy) || []

      const record: RecordsToEmail = {
        status: result.status,
        trackingId: result.trackingId || result.id,
        ...(result.causesOfDeath ? { ucCode: result.causesOfDeath } : {})
      }

      existing.push(record)

      recordsByUser.set(result.createdBy, existing)
    }
  }

  // Send ONE email per user with ALL their records
  for (const [userId, records] of recordsByUser) {
    try {
      const userInfo = await getUserById(token, userId)

      if (!userInfo) {
        continue
      }

      if (!userInfo.email) {
        continue
      }

      // Send single email with all record IDs for this user
      const result = await sendProcessingNotificationEmail(
        token,
        userInfo,
        records
      )
    } catch (error) {
      console.error(
        `[EMAIL-NOTIFICATION] Error sending email to user ${userId}:`,
        error
      )
    }
  }
}

/**
 * Send email notification to a user about processed records
 * Uses the custom death-record-correction-notification endpoint on country config server
 */
export async function sendProcessingNotificationEmail(
  token: string,
  userInfo: UserInfo,
  records: RecordsToEmail[]
): Promise<boolean> {
  // Use COUNTRY_CONFIG_HOST since the endpoint is defined in country config server (port 3040)
  const url = new URL(
    'death-record-correction-notification',
    COUNTRY_CONFIG_HOST
  ).toString()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: {
          name: {
            firstname: userInfo.firstName,
            surname: userInfo.lastName
          },
          email: userInfo.email
        },
        records
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[DEATH-RECORD-CORRECTION] Error response:', errorText)
      return false
    }

    const result = await response.json()
    return true
  } catch (error) {
    console.error('[DEATH-RECORD-CORRECTION] Exception:', error)
    return false
  }
}
