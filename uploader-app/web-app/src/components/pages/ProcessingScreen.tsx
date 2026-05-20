import { Text } from '@mantine/core';
import { Loader2, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProcessingProgress } from '../../util/types';

export function ProcessingScreen({ currentProgress }: { currentProgress: ProcessingProgress }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
          <h2 className="text-2xl mb-3">Processing SPC Encoded Records</h2>

          {currentProgress && (
            <div className="text-center mb-4">
              <Text size="lg" className="mb-1">
                Record {currentProgress.current} of {currentProgress.total}
              </Text>
            </div>
          )}
        </div>

        {/* Current Record Being Processed */}
        {currentProgress && currentProgress.currentTrackingId && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <Text size="sm" c="dimmed" className="mb-1">
              Currently processing:
            </Text>
            <Text size="lg" className="font-mono font-semibold">
              {currentProgress.currentTrackingId}
            </Text>
          </div>
        )}

        {/* Processing Steps */}
        <div className="space-y-3 mb-6">
          <div className='p-4 rounded-lg border-2 transition-all bg-gray-50 border-gray-200'>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-500" />
              <div>
                <Text className="font-medium">Finding record in database</Text>
              </div>
            </div>
          </div>

          <div className='p-4 rounded-lg border-2 transition-all bg-gray-50 border-gray-200'>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <Text className="font-medium">Checking record status</Text>
              </div>
            </div>
          </div>

          <div className='p-4 rounded-lg border-2 transition-all bg-gray-50 border-gray-200'>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <Text className="font-medium">Correcting or skipping</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <Text className="font-semibold text-amber-900 mb-1">
                Please do not close this window
              </Text>
              <Text size="sm" c="dimmed">
                Processing is in progress. Closing this window will interrupt the operation and may result in incomplete updates. Please wait until all records have been processed.
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
