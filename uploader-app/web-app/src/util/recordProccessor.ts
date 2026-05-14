import { createClient } from '@opencrvs/toolkit/api'
import { ActionStatus } from '@opencrvs/toolkit/events'
import {
  ProcessingResult,
  ProcessingSummary,
  SpcCodingDatabaseRecord
} from './types'
import { GATEWAY_HOST } from './constants'
import { v4 as uuidv4 } from 'uuid'
import {
  findRecordByTrackingId,
  markSPCCodedRecordsAsProcessed
} from '../services/recordService'
import { getDecodedToken } from '../services/token'

const correctRecord = async (
  trackingId: string,
  row: SpcCodingDatabaseRecord
): Promise<boolean> => {
  const url = new URL('events', GATEWAY_HOST).toString()
  const token = localStorage.getItem('authToken')
  if (!token) {
    throw new Error('Authentication token not found. Please log in.')
  }

  const decodedToken = getDecodedToken(token)
  const client = createClient(url, `Bearer ${token}`)
  const record = await findRecordByTrackingId(token, trackingId)
  if (!record) {
    throw new Error('Record not found.')
  }

  // Handle if assign fails due to record being assinged to another user
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

  console.log('updatedDeclaration :>> ', updatedDeclaration)

  console.log('record from search API :>> ', record)

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
    (a) =>
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

export const processRecord = async (
  row: SpcCodingDatabaseRecord,
  rowIndex: number
): Promise<ProcessingResult> => {
  const trackingId = row.trackingId.trim()

  try {
    // Extract cause of death code from rows with status "completed"
    const causesOfDeath = row.ucCode

    // Extract freeText from rows with status "rejected"
    const irisRejectionReason = row.freeText

    if (row.status === 'completed' && !causesOfDeath) {
      return {
        rowIndex,
        id: trackingId,
        status: 'skipped',
        message: 'No cause of death codes found in row'
      }
    }

    if (row.status === 'rejected' && !irisRejectionReason) {
      return {
        rowIndex,
        id: trackingId,
        status: 'skipped',
        message: 'No rejection reasons found in row'
      }
    }

    // Correct the record with the cause of death codes
    const updated = await correctRecord(trackingId, row)

    if (!updated) {
      return {
        rowIndex,
        id: trackingId,
        status: 'error',
        message: 'Failed to update record'
      }
    }
    if (row.status === 'completed' && causesOfDeath) {
      return {
        rowIndex,
        id: trackingId,
        status: 'success',
        message: `Successfully updated`,
        causesOfDeath
      }
    }
    return {
      rowIndex,
      id: trackingId,
      status: 'success',
      message: `Successfully updated`,
      irisRejectionReason
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
    const result = await processRecord(rows[i], i + 1)
    results.push(result)
  }

  const successfulResults = results.filter((r) => r.status === 'success')
  const successfulResultsIds = successfulResults.map((r) => r.id)

  await markSPCCodedRecordsAsProcessed(successfulResultsIds)

  const summary: ProcessingSummary = {
    total: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    /* rejected: results.filter((r) => r.status === 'rejected').length, */
    results
  }

  console.log('summary :>> ', summary)

  // Send email notifications - one email per user with all their processed records
  // await sendEmailNotifications(token, results)

  return summary
}
