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

import {
  defineFormPage,
  FieldType,
  ConditionalType,
  user,
  event,
  ActionType,
  or
} from '@opencrvs/toolkit/events'

export const irisOutput = defineFormPage({
  id: 'irisOutput',
  title: {
    defaultMessage: 'Iris Output',
    description: 'Form section title for iris output',
    id: 'spcCodingGroup.irisOutput.title'
  },
  conditional: or(
    user.hasRole('LOCAL_REGISTRAR'),
    event.hasAction(ActionType.REGISTER),
    event.hasAction(ActionType.REJECT)
  ),
  fields: [
    {
      id: 'irisOutput.ucCode',
      type: FieldType.TEXT,
      conditionals: [
        {
          type: ConditionalType.ENABLE,
          conditional: user.hasRole('LOCAL_REGISTRAR')
        }
      ],
      required: false,
      defaultValue: 'None',
      analytics: true,
      label: {
        defaultMessage: 'UC Code',
        description: 'Form section title for uc code',
        id: 'spcCodingGroup.ucCode.title'
      }
    },
    {
      id: 'irisOutput.selectedCodes',
      type: FieldType.TEXT,
      conditionals: [
        {
          type: ConditionalType.ENABLE,
          conditional: user.hasRole('LOCAL_REGISTRAR')
        }
      ],
      required: false,
      defaultValue: 'None',
      analytics: true,
      label: {
        defaultMessage: 'Selected Codes',
        description: 'Form section title for selectedCodes',
        id: 'spcCodingGroup.selectedCodes.title'
      }
    },
    {
      id: 'irisOutput.multipleCodes',
      type: FieldType.TEXT,
      conditionals: [
        {
          type: ConditionalType.ENABLE,
          conditional: user.hasRole('LOCAL_REGISTRAR')
        }
      ],
      required: false,
      defaultValue: 'None',
      analytics: true,
      label: {
        defaultMessage: 'Multiple Codes',
        description: 'Form section title for multipleCodes',
        id: 'spcCodingGroup.multipleCodes.title'
      }
    },
    {
      id: 'irisOutput.freeText',
      type: FieldType.TEXTAREA,
      label: {
        defaultMessage: 'Free text',
        id: 'spcCodingGroup.freeText.title',
        description: 'Label for the free text field in the Iris Output section'
      },
      analytics: true,
      required: false,
      conditionals: [
        {
          type: ConditionalType.ENABLE,
          conditional: user.hasRole('LOCAL_REGISTRAR')
        }
      ]
    }
  ]
})
