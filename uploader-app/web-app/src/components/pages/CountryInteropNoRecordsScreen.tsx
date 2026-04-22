import { Alert, Text } from '@mantine/core';
import { Database, CheckCircle } from 'lucide-react';

export function CountryInteropNoRecordsScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl mb-4">SPC Encoded Records</h1>
          <p className="text-gray-600">
            Check for records from SPC Mortality Group
          </p>
        </div>

        {/* No Records Available */}
        <Alert
          icon={<Database className="w-6 h-6" />}
          title="No Records Available"
          color="gray"
          mb="md"
          className="border-2"
        >
          <Text size="sm">
            There are currently no records from the SPC Mortality Group ready for processing.
          </Text>
        </Alert>

        {/* Success Message */}
        <div className="p-6 bg-green-50 border-2 border-green-300 rounded-lg">
          <div className="flex items-start gap-4">
            <CheckCircle className="text-green-700 mt-1" size={32} strokeWidth={1.5} />
            <div>
              <h2 className="text-xl text-green-900 mb-2">
                All records have been processed
              </h2>
              <p className="text-green-800">
                All available records from the coding group have been successfully processed and imported into your system. Check back later for new records.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
