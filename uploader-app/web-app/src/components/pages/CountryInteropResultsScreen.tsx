import { Button, Badge, Accordion, Text, Alert, Card, Group, ScrollArea } from '@mantine/core';
import { CheckCircle, XCircle, AlertCircle, SkipForward, Database, Copy, AlertTriangle } from 'lucide-react';
import { ProcessingSummary } from '../../util/types';
import { RejectedRecord } from '../../util/types';
import { useState } from 'react';

interface CountryInteropResultsScreenProps {
  summary: ProcessingSummary;
  rejectedRecords: RejectedRecord[];
  onReturnToUpload: () => void;
}

export function CountryInteropResultsScreen({
  summary,
  rejectedRecords,
  onReturnToUpload
}: CountryInteropResultsScreenProps) {
  const hasSkipped = summary.skipped > 0;
  const hasErrors = summary.errors > 0;
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const handleCopyRejectedList = () => {
    const text = rejectedRecords
      .map((record) => `${record.trackingId}: ${record.reason}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  return (
    <div className="flex flex-col items-center h-screen overflow-y-auto p-8 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl mb-4">Processing Complete</h1>
          <p className="text-gray-600">
            Records from the SPC Mortality Group have been processed. Review the results below.
          </p>
        </div>

        {/* Database Cleared Warning */}
        <Alert
          icon={<Database className="w-6 h-6" />}
          title="Temporary Database Cleared"
          color="blue"
          mb="lg"
          className="border-2 border-blue-400"
        >
          <Text size="sm" fw={500}>
            The temporary database containing records from the coding group has now been cleared.
            All successfully processed records have been added as corrections to your registrations.
          </Text>
        </Alert>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <div className="text-center">
              <Text size="sm" c="dimmed" mb={4}>
                Total Records
              </Text>
              <Text size="xl" fw={700}>
                {summary.total}
              </Text>
            </div>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder className="border-green-200">
            <div className="text-center">
              <Text size="sm" c="dimmed" mb={4}>
                Successful
              </Text>
              <Text size="xl" fw={700} c="green">
                {summary.successful}
              </Text>
            </div>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder className="border-yellow-200">
            <div className="text-center">
              <Text size="sm" c="dimmed" mb={4}>
                Skipped
              </Text>
              <Text size="xl" fw={700} c="orange">
                {summary.skipped}
              </Text>
            </div>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder className="border-red-200">
            <div className="text-center">
              <Text size="sm" c="dimmed" mb={4}>
                Errors
              </Text>
              <Text size="xl" fw={700} c="red">
                {summary.errors}
              </Text>
            </div>
          </Card>
        </div>

        {/* Success Message */}
        {summary.successful > 0 && (
          <Alert
            icon={<CheckCircle className="w-5 h-5" />}
            title="Records Corrected Successfully"
            color="green"
            mb="md"
          >
            {summary.successful} record(s) were successfully corrected with cause of death codes.
          </Alert>
        )}

        {/* Skipped Message */}
        {hasSkipped && (
          <Alert
            icon={<SkipForward className="w-5 h-5" />}
            title="Records Skipped"
            color="orange"
            mb="md"
          >
            {summary.skipped} record(s) were skipped. See details below.
          </Alert>
        )}

        {/* Errors Message */}
        {hasErrors && (
          <Alert
            icon={<AlertCircle className="w-5 h-5" />}
            title="Errors Occurred"
            color="red"
            mb="md"
          >
            {summary.errors} error(s) occurred during processing. See details below.
          </Alert>
        )}

        {/* Rejected Records Section */}
        {rejectedRecords.length > 0 && (
          <Card shadow="sm" padding="lg" radius="md" withBorder mb="lg" className="border-2 border-red-300 bg-red-50">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-700 mt-1" size={24} strokeWidth={2} />
                <div>
                  <Text size="lg" fw={700} c="red.9" mb={2}>
                    {rejectedRecords.length} rejected record{rejectedRecords.length !== 1 ? 's have' : ' has'} been corrected with the reason for rejection by the coding group
                  </Text>
                  <Text size="sm" c="red.8" fw={500}>
                    ⚠️ IMPORTANT: This is your last chance to copy this list so that you can easily find these records and make any necessary corrections should you wish the SPC Mortality Coding Group to attempt to re-code these records again.
                  </Text>
                </div>
              </div>
              <Button
                onClick={handleCopyRejectedList}
                variant="filled"
                color={copiedToClipboard ? "green" : "red"}
                leftSection={copiedToClipboard ? <CheckCircle size={16} /> : <Copy size={16} />}
                className="flex-shrink-0"
              >
                {copiedToClipboard ? 'Copied!' : 'Copy List'}
              </Button>
            </div>

            <ScrollArea h={250} className="bg-white rounded border-2 border-red-200 p-4">
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
                      <span className="text-sm text-red-800">{record.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Detailed Results */}
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
          <Text size="lg" fw={500} mb="md">
            Detailed Processing Results
          </Text>

          <Accordion variant="contained">
            {summary.results.map((result, index) => {
              const Icon =
                result.status === 'success'
                  ? CheckCircle
                  : result.status === 'error'
                  ? XCircle
                  : SkipForward;

              const color =
                result.status === 'success'
                  ? 'green'
                  : result.status === 'error'
                  ? 'red'
                  : 'orange';

              return (
                <Accordion.Item key={index} value={`item-${index}`}>
                  <Accordion.Control>
                    <Group gap="sm">
                      <Icon className={`w-5 h-5 text-${color}-500`} />
                      <Text>
                        Record {result.rowIndex}
                        {result.id && `: ${result.id}`}
                      </Text>
                      <Badge color={color} variant="light" ml="auto">
                        {result.status}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <div className="space-y-2">
                      <Text size="sm">
                        <strong>Status:</strong>{' '}
                        <span className={`text-${color}-600`}>
                          {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                        </span>
                      </Text>
                      <Text size="sm">
                        <strong>Message:</strong> {result.message}
                      </Text>
                      {result.causesOfDeath && result.causesOfDeath.length > 0 && (
                        <Text size="sm">
                          <strong>Cause(s) of Death Added:</strong>{' '}
                          {result.causesOfDeath.join(', ')}
                        </Text>
                      )}
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </Card>

        {/* Return Button */}
        <div className="flex justify-center">
          <Button
            leftSection={<Database className="w-4 h-4" />}
            size="lg"
            onClick={onReturnToUpload}
          >
            Check for New Records
          </Button>
        </div>
      </div>
    </div>
  );
}
