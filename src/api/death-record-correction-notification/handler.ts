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
import * as Hapi from '@hapi/hapi'
import * as Joi from 'joi'
import { sendCoDEmail } from './service'

/**
 * Payload schema for death record correction notification
 */
export const deathRecordCorrectionNotificationSchema = Joi.object({
  recipient: Joi.object({
    name: Joi.object({
      firstname: Joi.string().required(),
      surname: Joi.string().required()
    }).required(),
    email: Joi.string().email().required()
  }).required(),
  records: Joi.array()
    .items(
      Joi.object({
        status: Joi.string()
          .valid('success', 'rejected', 'corrected')
          .required(),
        trackingId: Joi.string().required(),
        ucCode: Joi.string().optional()
      })
    )
    .min(1)
    .required()
})

export interface RecordsToEmail {
  status: 'success' | 'rejected' | 'corrected'
  /** The tracking ID of the record for display in emails */
  trackingId?: string
  /** The uc code of the record for display in emails */
  ucCode?: string
}

export interface DeathRecordCorrectionNotificationPayload {
  recipient: {
    name: {
      firstname: string
      surname: string
    }
    email: string
  }
  records: RecordsToEmail[]
}

/**
 * Handler for death record correction notifications.
 * Sends an email to the user that created the death records about corrections made to their death records.
 */
export async function deathRecordCorrectionNotificationHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit
) {
  const payload = request.payload as DeathRecordCorrectionNotificationPayload

  return await sendCoDEmail(payload, h)
}
