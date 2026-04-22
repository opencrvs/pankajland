import { Text } from '@mantine/core';
import { Loader2, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProcessingProgress } from '../../util/types';

interface CountryInteropProcessingScreenProps {
  currentProgress?: ProcessingProgress;
}

export function CountryInteropProcessingScreen({ currentProgress }: CountryInteropProcessingScreenProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Estimate time: ~2-3 seconds per row
  const SECONDS_PER_ROW = 2.5;

  useEffect(() => {
    if (currentProgress) {
      const remaining = currentProgress.total - currentProgress.current;
      setTimeRemaining(Math.ceil(remaining * SECONDS_PER_ROW));
    }
  }, [currentProgress]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getStepIcon = (step: string) => {
    switch(step) {
      case 'finding':
        return <Database className="w-5 h-5 text-blue-500" />;
      case 'checking':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'deciding':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

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
              {timeRemaining > 0 && (
                <Text c="dimmed" size="sm">
                  Estimated time remaining: {formatTime(timeRemaining)}
                </Text>
              )}
            </div>
          )}
        </div>

        {/* Current Certificate Being Processed */}
        {currentProgress && currentProgress.currentCertificateKey && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <Text size="sm" c="dimmed" className="mb-1">
              Currently processing:
            </Text>
            <Text size="lg" className="font-mono font-semibold">
              {currentProgress.currentCertificateKey}
            </Text>
          </div>
        )}

        {/* Processing Steps */}
        <div className="space-y-3 mb-6">
          <div className={`p-4 rounded-lg border-2 transition-all ${
            currentProgress?.currentStep === 'finding'
              ? 'bg-blue-50 border-blue-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              {getStepIcon('finding')}
              <div>
                <Text className="font-medium">Finding record in database</Text>
                {currentProgress?.currentStep === 'finding' && (
                  <Text size="sm" c="dimmed">{currentProgress.stepDescription}</Text>
                )}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 transition-all ${
            currentProgress?.currentStep === 'checking'
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              {getStepIcon('checking')}
              <div>
                <Text className="font-medium">Checking record status</Text>
                {currentProgress?.currentStep === 'checking' && (
                  <Text size="sm" c="dimmed">{currentProgress.stepDescription}</Text>
                )}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-2 transition-all ${
            currentProgress?.currentStep === 'deciding'
              ? 'bg-green-50 border-green-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              {getStepIcon('deciding')}
              <div>
                <Text className="font-medium">Correcting or skipping</Text>
                {currentProgress?.currentStep === 'deciding' && (
                  <Text size="sm" c="dimmed">{currentProgress.stepDescription}</Text>
                )}
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
