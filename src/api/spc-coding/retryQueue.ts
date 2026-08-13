/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * OpenCRVS is also distributed under the terms of the Civil Registration
 * & Healthcare Disclaimer located at http://opencrvs.org/license.
 *
 * Copyright (C) The OpenCRVS Authors located at https://github.com/opencrvs/opencrvs-core/blob/master/AUTHORS.
 */
import { sql } from 'kysely'
import { getClient } from './postgres'
import { EventDocument } from '@opencrvs/toolkit/events'

export interface RetryQueueEntry {
  eventId: string
  trackingId: string | null
  payload: EventDocument
  attempts: number
  lastError: string
  createdAt: string
  lastAttemptedAt: string
}

export async function upsertFailedSubmission(
  eventId: string,
  trackingId: string,
  payload: EventDocument,
  errorMessage: string
) {
  const db = getClient()

  await sql`
    INSERT INTO spc.outbound_retry_queue (event_id, tracking_id, payload, last_error)
    VALUES (${eventId}, ${trackingId}, ${JSON.stringify(payload)}, ${errorMessage})
    ON CONFLICT (event_id) DO UPDATE SET
      payload = excluded.payload,
      last_error = excluded.last_error,
      last_attempted_at = now(),
      attempts = spc.outbound_retry_queue.attempts + 1
  `.execute(db)
}

export async function getRetryQueueEntries(): Promise<RetryQueueEntry[]> {
  const db = getClient()

  const rows = await db
    .selectFrom('spc.outbound_retry_queue')
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()

  return rows.map((row) => ({
    eventId: row.eventId,
    trackingId: row.trackingId,
    payload: JSON.parse(row.payload) as EventDocument,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    lastAttemptedAt: row.lastAttemptedAt
  }))
}

export async function deleteRetryQueueEntryByEventId(
  eventId: string
): Promise<boolean> {
  const db = getClient()

  const result = await db
    .deleteFrom('spc.outbound_retry_queue')
    .where('eventId', '=', eventId)
    .executeTakeFirst()

  return Number(result.numDeletedRows) > 0
}
