import { getClient } from './postgres'
import { sql } from 'kysely'
import Hapi from '@hapi/hapi'
import { ProcessingResult, sendEmailNotifications } from './utils'

type SpcCodingDatabaseRecord = {
  trackingId: string
  status: string
  ucCode: string
  selectedCodes: string
  multipleCodes: string
  freeText: string
  comments: string
  processedBySystem: string | null
}

type MarkProcessedPayload = {
  trackingIds: string[]
}

export async function getPendingSpcCodingHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const db = getClient()

  try {
    const rows = await db
      .selectFrom('spc.coding')
      .selectAll()
      .where('processedBySystem', 'is', null)
      .execute()

    const results: SpcCodingDatabaseRecord[] = rows.map((row) => ({
      trackingId: row.trackingId,
      status: row.status,
      ucCode: row.ucCode,

      selectedCodes: row.selectedCodes,
      multipleCodes: row.multipleCodes,

      freeText: row.freeText,
      comments: row.comments,

      createdAt: row.createdAt,
      processedBySystem: row.processedBySystem
    }))
    return h.response({ results }).code(200)
  } catch (err) {
    request.log(['error'], err)

    return h.response({ error: 'Internal server error' }).code(500)
  }
}

export async function createSpcCodingHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const db = getClient()

  const payload = request.payload as SpcCodingDatabaseRecord

  try {
    const existingRow = await db
      .selectFrom('spc.coding')
      .selectAll()
      .where('trackingId', '=', payload.trackingId)
      .executeTakeFirst()

    if (!existingRow) {
      const insertedRow = await db
        .insertInto('spc.coding')
        .values({
          trackingId: payload.trackingId,
          status: payload.status,
          ucCode: payload.ucCode,
          selectedCodes: payload.selectedCodes,
          multipleCodes: payload.multipleCodes,
          freeText: payload.freeText,
          comments: payload.comments,
          processedBySystem: payload.processedBySystem
        })
        .returningAll()
        .executeTakeFirst()

      return h.response({ result: insertedRow }).code(201)
    }

    if (existingRow.status === 'Final') {
      return h
        .response({
          error: `Tracking ID ${payload.trackingId} has already been finalized`
        })
        .code(409)
    }

    if (existingRow.status === 'Rejected') {
      const updatedRow = await db
        .updateTable('spc.coding')
        .set({
          status: payload.status,
          ucCode: payload.ucCode,
          selectedCodes: payload.selectedCodes,
          multipleCodes: payload.multipleCodes,
          comments: payload.comments,
          // Reset because the record needs processing again
          processedBySystem: null,
          freeText: null
        })
        .where('trackingId', '=', payload.trackingId)
        .returningAll()
        .executeTakeFirst()

      return h.response({ result: updatedRow }).code(200)
    }

    return h
      .response({
        error: `Unsupported status: ${existingRow.status}`
      })
      .code(400)
  } catch (err) {
    request.log(['error'], err)

    return h.response({ error: 'Internal server error' }).code(500)
  }
}

export async function markSpcCodingProcessedHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const db = getClient()

  const payload = request.payload as MarkProcessedPayload

  try {
    if (
      !payload.trackingIds ||
      !Array.isArray(payload.trackingIds) ||
      payload.trackingIds.length === 0
    ) {
      return h
        .response({ error: 'trackingIds must be a non-empty array' })
        .code(400)
    }

    const updatedRows = await db
      .updateTable('spc.coding')
      .set({
        processedBySystem: sql`now()`
      })
      .where('trackingId', 'in', payload.trackingIds)
      .returningAll()
      .execute()

    return h
      .response({
        updatedCount: updatedRows.length,
        results: updatedRows
      })
      .code(200)
  } catch (err) {
    request.log(['error'], err)

    return h.response({ error: 'Internal server error' }).code(500)
  }
}

export async function notifySpcCodingHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const token = request.auth.artifacts.token as string
  const results = request.payload as ProcessingResult[]
  try {
    await sendEmailNotifications(token, results)
    return h
      .response({
        success: true,
        msg: 'Successfully notified incoming SPC coded records'
      })
      .code(200)
  } catch (err) {
    request.log(['error'], err)

    return h
      .response({ error: 'Unable to notify about SPC coded records' })
      .code(500)
  }
}
