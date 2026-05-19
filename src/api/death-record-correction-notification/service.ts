import * as Hapi from '@hapi/hapi'
import { sendEmail } from '../notification/email-service'
import { SENDER_EMAIL_ADDRESS } from '../notification/constant'
import { applicationConfig } from '../application/application-config'
import { LOGIN_URL } from '@countryconfig/constants'
import { logger, maskEmail } from '@countryconfig/logger'
import {
  DeathRecordCorrectionNotificationPayload,
  RecordsToEmail
} from './handler'

const renderSection = (
  records: RecordsToEmail[],
  intro: string,
  plural: boolean = true
) => {
  if (!records.length) return ''
  const loginUrl = LOGIN_URL || 'https://login.spc-cod.opencrvs.org'
  return `
    <p>${intro}</p>
    <ul>
      ${records
        .map(
          (record) =>
            `<li>TrackingID: ${record.trackingId} ${record.ucCode ? ` / UC Code: ${record.ucCode}` : ''}</li>`
        )
        .join('')}
    </ul>
    <p>
      Login to <a href="${loginUrl}">${loginUrl}</a> to access ${
        plural ? 'these records' : 'this record'
      }.
    </p>
  `
}

export async function sendCoDEmail(
  payload: DeathRecordCorrectionNotificationPayload,
  h: Hapi.ResponseToolkit
) {
  logger.info(
    `Processing notification request for ${maskEmail(payload.recipient.email)} with ${payload.records.length} records`
  )

  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      `Development mode - would send email to ${payload.recipient.email}`
    )
  }

  // Check if email delivery is configured
  if (applicationConfig.USER_NOTIFICATION_DELIVERY_METHOD !== 'email') {
    logger.info(
      `Skipping email notification: USER_NOTIFICATION_DELIVERY_METHOD is not 'email'`
    )
    return h
      .response({ success: true, message: 'Notification skipped' })
      .code(200)
  }

  const successRecords = payload.records.filter(
    (r) => r.status === 'success' && r.ucCode
  )
  const rejectedRecords = payload.records.filter(
    (r) => r.status === 'success' && !r.ucCode
  )

  const applicationName = applicationConfig.APPLICATION_NAME || 'OpenCRVS'

  // Build email content
  const emailBody = `
  <p>Dear ${payload.recipient.name.firstname} ${payload.recipient.name.surname},</p>

  ${renderSection(
    successRecords,
    'The following death records have been encoded with cause of death codes and are ready to view:'
  )}

  ${renderSection(
    rejectedRecords,
    `The following records were rejected and could not be coded.<br />
   If you wish coding to be attempted again, please advise a Registrar to make cause corrections after consultation:`
  )}

  <p>Best regards,<br>${applicationName}</p>
`

  try {
    console.log('EMAIL BODY :>> ', emailBody)
    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `Would send email to ${maskEmail(payload.recipient.email)} with subject: Death Records Processed - Cause of Death Codes Updated`
      )
      return h.response({ success: true }).code(200)
    }

    await sendEmail({
      subject: 'Death Records Processed - Cause of Death Codes Updated',
      html: emailBody,
      from: SENDER_EMAIL_ADDRESS,
      to: payload.recipient.email
    })

    logger.info(
      `Email notification sent successfully to ${maskEmail(payload.recipient.email)}`
    )

    return h.response().code(200)
  } catch (error) {
    logger.error(`Failed to send email notification: ${error}`)
    return h
      .response({ success: false, message: 'Failed to send email' })
      .code(500)
  }
}
