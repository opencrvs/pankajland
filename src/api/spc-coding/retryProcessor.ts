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
import { logger } from '@countryconfig/logger'
import { postSpcRecord } from './utils'
import {
  deleteRetryQueueEntryByEventId,
  getRetryQueueEntries,
  upsertFailedSubmission
} from './retryQueue'

// A possibly corrupt record stops being
// retried after this many attempts, but stays visible via
// GET /spc-coding/retry-queue for an admin to inspect/discard.
const MAX_RETRY_ATTEMPTS = 10

export interface RetryQueueProcessingResult {
  skipped: boolean
  attempted: number
  succeeded: number
  failed: number
}

let isRunning = false

export async function processSpcRetryQueue(): Promise<RetryQueueProcessingResult> {
  if (isRunning) {
    return { skipped: true, attempted: 0, succeeded: 0, failed: 0 }
  }

  isRunning = true

  try {
    const entries = await getRetryQueueEntries()
    let succeeded = 0
    let failed = 0

    for (const entry of entries) {
      try {
        await postSpcRecord(entry.payload)
        await deleteRetryQueueEntryByEventId(entry.eventId)
        succeeded++
      } catch (error) {
        if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
          logger.error(
            `SPC retry queue: giving up on event ${entry.eventId} after ${entry.attempts} attempts`,
            error
          )
          continue
        }

        const message = error instanceof Error ? error.message : String(error)
        await upsertFailedSubmission(
          entry.eventId,
          entry.trackingId ?? '',
          entry.payload,
          message
        )
        failed++
      }
    }

    return { skipped: false, attempted: entries.length, succeeded, failed }
  } finally {
    isRunning = false
  }
}
