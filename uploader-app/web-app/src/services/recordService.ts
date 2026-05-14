import { GATEWAY_HOST, COUNTRY_CONFIG_HOST } from '../util/constants'
import { createClient } from '@opencrvs/toolkit/api'
import { UserInfo, RecordsToEmail, SpcCodingDatabaseRecord } from '../util/types'

export interface DeathRecord {
  id: string
  type: string
  status: string
  legalStatuses?: Record<string, LegalStatus>
  createdAt?: string
  dateOfEvent?: string
  placeOfEvent?: string
  createdBy?: string
  assignedTo?: string
  createdByUserType?: string
  updatedByUserRole?: string
  createdAtLocation?: string
  updatedAtLocation?: string
  updatedAt?: string
  updatedBy?: string
  trackingId?: string
  potentialDuplicates?: string[]
  flags?: string[]
  declaration: Record<string, string>
}

export interface LegalStatus {
  createdAt: string
  createdBy: string
  createdAtLocation: string
  createdByUserType: string
  acceptedAt: string
  createdByRole: string
  registrationNumber?: string
}

export interface SearchResult {
  results: DeathRecord[]
  total: number
}

/**
 * Find a death record by TrackingId using the OpenCRVS search API
 */
export async function findRecordByTrackingId(
  token: string,
  trackingId: string
): Promise<DeathRecord | null> {
  const url = new URL('events', GATEWAY_HOST).toString()
  const client = createClient(url, `Bearer ${token}`)

  try {
    const response = await client.event.search.query({
      query: {
        type: 'and',
        clauses: [
          {trackingId: {
            term: trackingId,
            type: 'exact'
          } }
        ]
      },
      limit: 1,
      offset: 0
    })

    // Handle different response formats
    const results = (response as any)?.results || []

    if (results.length === 0) {
      console.log(
        '[DEBUG] findRecordByTrackingId - Not processed as trackingId was absent'
      )
      return null
    }

    const record = results[0]

    return record
  } catch (error) {
    throw error
  }
}

type SpcCodingApiResponse = {
  results: SpcCodingDatabaseRecord[]
}
/**
 * Fetch SPC Coded records from spc.coding table
 */
export async function getPendingSPCRecords(): Promise<SpcCodingDatabaseRecord[] | []> {
  try {
    const response = await fetch(
      new URL('spc-coding', COUNTRY_CONFIG_HOST)
    )

    if (!response.ok) {
      return []
    }

    const data: SpcCodingApiResponse = await response.json()

    return data.results
  } catch {
    return []
  }
}

/**
 * Mark SPC coded records as processed
 */
export async function markSPCCodedRecordsAsProcessed(
  trackingIds: string[]
): Promise<boolean> {
  try {
    const response = await fetch(
      new URL('spc-coding/processed', COUNTRY_CONFIG_HOST),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trackingIds
        })
      }
    )

    return response.ok
  } catch {
    return false
  }
}


/**
 * Extract the createdBy user ID from the DECLARED legal status
 */
export function getCreatedByFromLegalStatuses(
  legalStatuses?: Record<string, LegalStatus>
): string | null {
  if (!legalStatuses) {
    return null
  }

  const declaredStatus = legalStatuses['DECLARED']
  if (declaredStatus?.createdBy) {
    return declaredStatus.createdBy
  }

  return null
}

/**
 * Send email notification to a user about processed records
 * Uses the custom ident-uploader-notification endpoint on country config server
 */
export async function sendProcessingNotificationEmail(
  token: string,
  userInfo: UserInfo,
  records: RecordsToEmail[]
): Promise<boolean> {
  // Use COUNTRY_CONFIG_HOST since the endpoint is defined in country config server (port 3040)
  const url = new URL(
    'ident-uploader-notification',
    COUNTRY_CONFIG_HOST
  ).toString()

  console.log('[IDENT-UPLOADER] Sending notification to:', userInfo.email)
  console.log('[IDENT-UPLOADER] Record IDs:', records)
  console.log('[IDENT-UPLOADER] URL:', url)

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

    console.log('[IDENT-UPLOADER] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[IDENT-UPLOADER] Error response:', errorText)
      return false
    }

    const result = await response.json()
    console.log('[IDENT-UPLOADER] Success response:', result)
    return true
  } catch (error) {
    console.error('[IDENT-UPLOADER] Exception:', error)
    return false
  }
}
