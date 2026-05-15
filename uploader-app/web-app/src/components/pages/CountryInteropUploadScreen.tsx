import { Button, Alert, ScrollArea, Text } from '@mantine/core'
import { AlertCircle, Copy, CheckCircle, Database } from 'lucide-react'
import { useState } from 'react'
import {
  SpcCodingDatabaseRecord
} from '../../util/types'
import { CountryInteropNoRecordsScreen } from './CountryInteropNoRecordsScreen'

interface CountryInteropUploadScreenProps {
  records: SpcCodingDatabaseRecord[] | []
  onProcessRecords: (records: SpcCodingDatabaseRecord[] | []) => void
}

export function CountryInteropUploadScreen({
  records,
  onProcessRecords
}: CountryInteropUploadScreenProps) {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  const readyRecords = records.filter((record) => record.status === 'completed')
  const rejectedRecords = records.filter(
    (record) => record.status === 'rejected'
  )

  const handleCopyRejectedList = () => {
    const text = rejectedRecords
      .map((record) => `${record.trackingId}: ${record.freeText}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopiedToClipboard(true)
    setTimeout(() => setCopiedToClipboard(false), 2000)
  }

  const handleProcessRecords = () => {
    onProcessRecords(records)
  }

  if (records.length === 0) {
    return <CountryInteropNoRecordsScreen />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl mb-4">SPC Encoded Records</h1>
          <p className="text-gray-600">
            Records from SPC Mortality Group ready for import
          </p>
        </div>

        {/* Process Button */}
        <div className="mb-6 flex justify-center">
          <Button
            onClick={handleProcessRecords}
            disabled={records?.length === 0}
            size="lg"
            className="bg-green-700 hover:bg-green-800 text-white disabled:bg-gray-400"
          >
            Process {records?.length} Record{records?.length !== 1 ? 's' : ''}
          </Button>
        </div>

        {/* Ready Records Card */}
        <div className="mb-6 p-6 bg-green-50 border-2 border-green-300 rounded-lg">
          <div className="flex items-start gap-4">
            <Database
              className="text-green-700 mt-1"
              size={32}
              strokeWidth={1.5}
            />
            <div className="flex-1">
              <h2 className="text-xl text-green-900 mb-2">
                {readyRecords?.length} record
                {readyRecords?.length !== 1 ? 's' : ''} ready to import
              </h2>
              <p className="text-green-800">
                {readyRecords && readyRecords.length > 0
                  ? `${readyRecords?.length} record${readyRecords?.length !== 1 ? 's have' : ' has'} been encoded by the SPC Mortality Group and ${readyRecords?.length !== 1 ? 'are' : 'is'} ready to be imported and added to existing registrations as corrections.`
                  : 'No records are currently available for import.'}
              </p>
            </div>
          </div>
        </div>

        {/* Rejected Records Card */}
        {rejectedRecords.length > 0 && (
          <div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="text-red-700 mt-1"
                  size={24}
                  strokeWidth={1.5}
                />
                <div>
                  <h2 className="text-xl text-red-900 mb-1">
                    {rejectedRecords.length} Rejected Record
                    {rejectedRecords.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="text-sm text-red-700">
                    These records were rejected by the coding group. The reason
                    for rejection will be entered as a comment on each record as
                    a correction.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCopyRejectedList}
                variant="outline"
                leftSection={
                  copiedToClipboard ? (
                    <CheckCircle size={16} />
                  ) : (
                    <Copy size={16} />
                  )
                }
                className={
                  copiedToClipboard
                    ? 'min-w-[120px] border-green-600 text-green-700 hover:bg-green-50'
                    : 'min-w-[120px] border-red-600 text-red-700 hover:bg-red-50'
                }
              >
                {copiedToClipboard ? 'Copied!' : 'Copy List'}
              </Button>
            </div>

            <ScrollArea
              h={300}
              className="bg-white rounded border border-red-200 p-4"
            >
              <div className="space-y-3">
                {rejectedRecords.map((record, index) => (
                  <div
                    key={record.trackingId}
                    className="pb-3 border-b border-red-100 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-sm text-red-900 font-semibold min-w-[120px]">
                        {record.trackingId}
                      </span>
                      <span className="text-sm text-red-800">
                        {record.freeText}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {rejectedRecords.length === 0 && (
          <Alert
            icon={<CheckCircle size={16} />}
            color="green"
            className="mt-4"
            title="No Rejections"
          >
            All records have been successfully processed by the coding group.
          </Alert>
        )}
      </div>
    </div>
  )
}
