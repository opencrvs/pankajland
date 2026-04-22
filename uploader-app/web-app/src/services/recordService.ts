import { GATEWAY_HOST, COUNTRY_CONFIG_HOST } from '../util/constants'
import { createClient } from '@opencrvs/toolkit/api'
import { v4 as uuidv4 } from 'uuid'
import { getDecodedToken } from './token'
import { UserInfo, RecordsToEmail } from '../util/types'
// import fetch from 'node-fetch'

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
 * Find a death record by CertificateKey using the OpenCRVS search API
 */
export async function findRecordByCertificateKey(
  token: string,
  certificateKey: string
): Promise<DeathRecord | null> {
  const url = new URL('events', GATEWAY_HOST).toString()
  const client = createClient(url, `Bearer ${token}`)

  try {
    const response = await client.event.search.query({
      query: {
        type: 'and',
        clauses: [
          { eventType: 'death' },
          {
            data: {
              'deceased.certificateKey': {
                type: 'exact',
                term: certificateKey
              }
            }
          }
        ]
      },
      limit: 1,
      offset: 0
    })

    // Handle different response formats
    const results = (response as any)?.results || []

    if (results.length === 0) {
      console.log(
        '[DEBUG] findRecordByCertificateKey - Not processed as certificateKey was absent'
      )
      return null
    }

    const record = results[0]

    return record
  } catch (error) {
    throw error
  }
}

/**
 * Update a death record with IRIS output fields using the OpenCRVS API
 * Updates: irisOutput.ucCode, irisOutput.selectedCodes, irisOutput.multipleCodes, irisOutput.comment
 */
export async function updateRecordWithCauseOfDeath(
  token: string,
  record: DeathRecord,
  row: any
): Promise<boolean> {
  const eventId = record.id
  const eventDeclaration = record.declaration
  const markedAsRejectedInOcrvs = record.flags?.includes('rejected')
  const url = new URL('events', GATEWAY_HOST).toString()
  const client = createClient(url, `Bearer ${token}`)

  const decodedToken = getDecodedToken(token)

  try {
    // Step 1: Use the assignment action to update the record with IRIS output fields
    const assignmentResult =
      await client.event.actions.assignment.assign.mutate({
        type: 'ASSIGN',
        eventId,
        transactionId: uuidv4(),
        assignedTo: decodedToken?.sub || 'unknown-user',
        annotation: {}
      })

    console.log(
      '[DEBUG] updateRecordWithCauseOfDeath - Assignment result:',
      assignmentResult
    )

    // Merge the IRIS output fields with the event declaration
    const updatedDeclaration = {
      ...eventDeclaration,
      'irisOutput.ucCode':
        row.UCCode || eventDeclaration?.['irisOutput.ucCode'] || '',
      'irisOutput.selectedCodes':
        row.SelectedCodes ||
        eventDeclaration?.['irisOutput.selectedCodes'] ||
        '',
      'irisOutput.multipleCodes':
        row.MultipleCodes ||
        eventDeclaration?.['irisOutput.multipleCodes'] ||
        '',
      'irisOutput.freeText':
        row.FreeText || eventDeclaration?.['irisOutput.freeText'] || ''
    }

    if (row.Status === 'Final' && markedAsRejectedInOcrvs) {
      // If the IRIS status has changed to "Final"
      // and the record has a [rejected] flag,
      // we should attempt to reprocess it

      // An event in 'DECLARED' state with [rejected] flag
      // can only accept the following actions
      // READ, NOTIFY, CUSTOM, EDIT, ARCHIVE.

      // Request EDIT action to remove the "rejected" flag
      const editResult = await client.event.actions.edit.request.mutate({
        transactionId: uuidv4(),
        declaration: updatedDeclaration,
        eventId,
        content: { reason: row.FreeText || '' },
        keepAssignment: true
      })

      // Request REGISTER action
      const registerResult = await client.event.actions.register.request.mutate(
        {
          declaration: updatedDeclaration,
          annotation: {
            status: row.Status || '',
            reason: row.FreeText || '',
            'review.comments': row.Comments || ''
          },
          eventId,
          transactionId: uuidv4()
        }
      )
    } else if (row.Status === 'Final') {
      // Request REGISTER action
      const registerResult = await client.event.actions.register.request.mutate(
        {
          declaration: updatedDeclaration,
          annotation: {
            status: row.Status || '',
            reason: row.FreeText || '',
            'review.comments': row.Comments || ''
          },
          eventId,
          transactionId: uuidv4()
        }
      )
    } else {
      // Request REJECT action if the IRIS status is "Rejected"
      const rejectResult = await client.event.actions.reject.request.mutate({
        transactionId: uuidv4(),
        declaration: updatedDeclaration,
        annotation: {
          status: row.Status || '',
          reason: row.FreeText || '',
          'review.comments': row.Comments || ''
        },
        eventId,
        content: { reason: row.FreeText || '' }
      })
    }

    return true
  } catch (error) {
    throw error
  }
}

/**
 * Fetch user details by user ID from OpenCRVS
 */
export async function getUserById(
  token: string,
  userId: string
): Promise<UserInfo | null> {
  const url = new URL('events', GATEWAY_HOST).toString()
  const client = createClient(url, `Bearer ${token}`)

  try {
    const userOrSystem = await client.user.get.query(userId)

    console.log('userOrSystem :>> ', userOrSystem)

    if (userOrSystem.type === 'user') {
      return {
        id: userOrSystem.id || userId,
        email: userOrSystem.email || '',
        firstName: userOrSystem.name?.[0]?.given?.[0] || '',
        lastName: userOrSystem.name?.[0]?.family || ''
      }
    }
    return null
  } catch (error) {
    return null
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
