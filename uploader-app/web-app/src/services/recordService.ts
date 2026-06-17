import { GATEWAY_HOST, COUNTRY_CONFIG_HOST } from '../util/constants'
import { createClient } from '@opencrvs/toolkit/api'
import {
  UserInfo,
  RecordsToEmail,
  SpcCodingDatabaseRecord,
  ProcessingResult,
  ProcessingSummary
} from '../util/types'
import { ActionBase, ActionStatus } from '@opencrvs/toolkit/events'
import { getDecodedToken } from './token'
import { v4 as uuidv4 } from 'uuid'

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

    if (userOrSystem.type === 'user') {
      return {
        id: userOrSystem.id || userId,
        email: userOrSystem.email,
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
          {
            trackingId: {
              term: trackingId,
              type: 'exact'
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
export async function getPendingSPCRecords(
  token: string
): Promise<SpcCodingDatabaseRecord[] | []> {
  try {
    const response = await fetch(new URL('spc-coding', COUNTRY_CONFIG_HOST), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

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
  trackingIds: string[],
  token: string
): Promise<boolean> {
  try {
    const response = await fetch(
      new URL('spc-coding/processed', COUNTRY_CONFIG_HOST),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
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

/**
 * Send email notifications to users about their processed records.
 * Groups all successful records by createdBy user and sends ONE email per user
 * containing all their processed record IDs.
 */
async function sendEmailNotifications(
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

const correctRecord = async (
  token: string,
  record: DeathRecord,
  row: SpcCodingDatabaseRecord
): Promise<boolean> => {
  const url = new URL('events', GATEWAY_HOST).toString()
  const decodedToken = getDecodedToken(token)
  const client = createClient(url, `Bearer ${token}`)

  // Handle if assign fails due to record being assigned to another user
  // throw error

  // Check if another correction is already in progress for this record and awaiting approval

  const assignmentResult = await client.event.actions.assignment.assign.mutate({
    type: 'ASSIGN',
    eventId: record.id,
    transactionId: uuidv4(),
    assignedTo: decodedToken?.sub || 'unknown-user',
    annotation: {}
  })

  const updatedDeclaration = {
    ...record?.declaration,
    'irisOutput.ucCode':
      row.ucCode || record?.declaration?.['irisOutput.ucCode'] || '',
    'irisOutput.selectedCodes':
      row.selectedCodes ||
      record?.declaration?.['irisOutput.selectedCodes'] ||
      '',
    'irisOutput.multipleCodes':
      row.multipleCodes ||
      record?.declaration?.['irisOutput.multipleCodes'] ||
      '',
    'irisOutput.freeText':
      row.freeText || record?.declaration?.['irisOutput.freeText'] || ''
  }

  const transactionId = uuidv4()
  // Request CORRECTION action
  const correctionResult =
    await client.event.actions.correction.request.request.mutate({
      eventId: record.id,
      declaration: updatedDeclaration,
      transactionId: transactionId,
      annotation: {},
      keepAssignment: true
    })

  const requestId = correctionResult.actions.find(
    (a: ActionBase) =>
      a.transactionId === transactionId && a.status === ActionStatus.Accepted
  )?.id

  if (!requestId) {
    throw new Error(
      `Request ID not found in response for eventId: ${record.id}, transactionId: ${transactionId}`
    )
  }

  const approveCorrectionResult =
    await client.event.actions.correction.approve.request.mutate({
      eventId: record.id,
      transactionId: uuidv4(),
      requestId,
      annotation: {
        isImmediateCorrection: true
      }
    })
  return approveCorrectionResult
}

const editRecord = async (
  token: string,
  record: DeathRecord,
  row: SpcCodingDatabaseRecord
): Promise<boolean> => {
  const url = new URL('events', GATEWAY_HOST).toString()
  const decodedToken = getDecodedToken(token)
  const client = createClient(url, `Bearer ${token}`)

  const assignmentResult = await client.event.actions.assignment.assign.mutate({
    type: 'ASSIGN',
    eventId: record.id,
    transactionId: uuidv4(),
    assignedTo: decodedToken?.sub || 'unknown-user',
    annotation: {}
  })

  const updatedDeclaration = {
    ...record?.declaration,
    'irisOutput.ucCode':
      row.ucCode || record?.declaration?.['irisOutput.ucCode'] || '',
    'irisOutput.selectedCodes':
      row.selectedCodes ||
      record?.declaration?.['irisOutput.selectedCodes'] ||
      '',
    'irisOutput.multipleCodes':
      row.multipleCodes ||
      record?.declaration?.['irisOutput.multipleCodes'] ||
      '',
    'irisOutput.freeText':
      row.freeText || record?.declaration?.['irisOutput.freeText'] || ''
  }

  const transactionId = uuidv4()
  // Request EDIT action
  const editResult = await client.event.actions.edit.request.mutate({
    eventId: record.id,
    declaration: updatedDeclaration,
    transactionId: transactionId,
    annotation: {},
    content: {}
  })

  const requestId = editResult.actions.find(
    (a: ActionBase) =>
      a.transactionId === transactionId && a.status === ActionStatus.Accepted
  )?.id

  if (!requestId) {
    throw new Error(
      `Request ID not found in response for eventId: ${record.id}, transactionId: ${transactionId}`
    )
  }

  return true
}

export const processRecord = async (
  row: SpcCodingDatabaseRecord,
  rowIndex: number,
  token: string
): Promise<ProcessingResult> => {
  const trackingId = row.trackingId.trim()

  const record = await findRecordByTrackingId(token, row.trackingId)
  if (!record) {
    throw new Error('Record not found.')
  }

  try {
    const causesOfDeath = row.ucCode
    const irisRejectionReason = row.freeText
    // Extract createdBy from legalStatuses.DECLARED.createdBy
    const createdBy = getCreatedByFromLegalStatuses(record.legalStatuses)

    if (row.status === 'Final' && !causesOfDeath) {
      return {
        rowIndex,
        id: trackingId,
        status: 'skipped',
        message: 'No cause of death codes found in row'
      }
    }

    if (row.status === 'Rejected' && !irisRejectionReason) {
      return {
        rowIndex,
        id: trackingId,
        status: 'skipped',
        message: 'No rejection reasons found in row'
      }
    }

    let updated

    // If the declaration has not been registered do an editRecord call
    if (record.status !== 'REGISTERED') {
      updated = await editRecord(token, record, row)
    } else {
      updated = await correctRecord(token, record, row)
    }


    if (!updated) {
      return {
        rowIndex,
        id: trackingId,
        status: 'error',
        message: 'Failed to update record'
      }
    }
    if (row.status === 'Final' && causesOfDeath) {
      return {
        rowIndex,
        id: trackingId,
        status: 'success',
        message: `Successfully updated`,
        causesOfDeath,
        createdBy: createdBy || undefined,
        trackingId
      }
    }
    return {
      rowIndex,
      id: trackingId,
      status: 'success',
      message: `Successfully updated`,
      irisRejectionReason,
      createdBy: createdBy || undefined,
      trackingId
    }
  } catch (error) {
    return {
      rowIndex,
      id: trackingId,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export const processRecords = async (
  rows: SpcCodingDatabaseRecord[],
  token: string,
  onProgress?: (
    current: number,
    total: number,
    currentTrackingId: string
  ) => void
): Promise<ProcessingSummary> => {
  const results: ProcessingResult[] = []

  for (let i = 0; i < rows.length; i++) {
    if (onProgress) {
      onProgress(i + 1, rows.length, rows[i].trackingId?.trim() || '')
    }
    const result = await processRecord(rows[i], i + 1, token)
    results.push(result)
  }

  const successfulResults = results.filter((r) => r.status === 'success')
  const successfulResultsIds = successfulResults.map((r) => r.id)

  await markSPCCodedRecordsAsProcessed(successfulResultsIds, token)

  const summary: ProcessingSummary = {
    total: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    /* rejected: results.filter((r) => r.status === 'rejected').length, */
    results
  }

  // Send email notifications - one email per user with all their processed records.
  await sendEmailNotifications(token, results)

  return summary
}
