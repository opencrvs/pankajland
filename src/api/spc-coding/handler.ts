import { getClient } from './postgres'
import Hapi from '@hapi/hapi'

type SpcCodingDatabaseRecord = {
  trackingId: string
  status: string
  ucCode: string
  selectedCodes: string[]
  multipleCodes: string[]
  freeText: string
  comments: string
  processedBySystem: string
}

export async function spcCodingHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const db = getClient()

  try {
    const rows = await db.selectFrom('spc.coding').selectAll().execute()

    const results: SpcCodingDatabaseRecord[] = rows.map((row) => ({
      trackingId: row.trackingId,
      status: row.status,
      ucCode: row.ucCode,

      selectedCodes: JSON.parse(row.selectedCodes ?? '[]'),
      multipleCodes: JSON.parse(row.multipleCodes ?? '[]'),

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

export async function insertSpcCodingHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const db = getClient()

  const payload = request.payload as SpcCodingDatabaseRecord

  try {
    const insertedRow = await db
      .insertInto('spc.coding')
      .values({
        trackingId: payload.trackingId,
        status: payload.status,
        ucCode: payload.ucCode,
        selectedCodes: JSON.stringify(payload.selectedCodes),
        multipleCodes: JSON.stringify(payload.multipleCodes),
        freeText: payload.freeText,
        comments: payload.comments,
        processedBySystem: payload.processedBySystem
      })
      .returningAll()
      .executeTakeFirst()

    return h.response({ result: insertedRow }).code(201)
  } catch (err) {
    request.log(['error'], err)

    return h.response({ error: 'Internal server error' }).code(500)
  }
}
