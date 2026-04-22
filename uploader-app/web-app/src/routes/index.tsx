import { MantineProvider } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import '../styles/mantine.css'
import { CountryInteropUploadScreen } from '../components/pages/CountryInteropUploadScreen'
import { ProcessingSummary, CSVRow, ProcessingProgress, DatabaseRecord, RejectedRecord  } from '../util/types'
import { processCSV } from '../util/csvProccessor'
import { CountryInteropNoRecordsScreen } from '../components/pages/CountryInteropNoRecordsScreen'
import { CountryInteropProcessingScreen } from '../components/pages/CountryInteropProcessingScreen'
import { CountryInteropResultsScreen } from '../components/pages/CountryInteropResultsScreen'
import { mockReadyRecords, mockRejectedRecords } from '../util/mockOpenCRVS'

type AppState = "upload" | "country-interop-upload" | "country-interop-no-records" | "processing" | "country-interop-processing" | "results" | "country-interop-results" | "error";

export const Route = createFileRoute('/')({
  component: HomeComponent
})

function HomeComponent() {
  const [state, setState] = useState<AppState>("country-interop-upload");
  const [currentProgress, setCurrentProgress] = useState<ProcessingProgress | undefined>();
  const [summary, setSummary] =
    useState<ProcessingSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleProcessDatabaseRecords = async (readyRecords: DatabaseRecord[], rejectedRecords: RejectedRecord[]) => {
    try {
      setState("country-interop-processing");
      setErrorMessage("");
      setCurrentProgress(undefined);

      // Convert ready records to CSV format
      const readyCsvRows: CSVRow[] = readyRecords.map((record) => ({
        id: record.certificateKey,
        CertificateKey: record.certificateKey,
        UCCode: record.ucCode || "",
        SelectedCodes: record.selectedCodes || "",
        MultipleCodes: record.multipleCodes || "",
      }));

      // Convert rejected records to CSV format (with empty codes since they're rejected)
      const rejectedCsvRows: CSVRow[] = rejectedRecords.map((record) => ({
        id: record.certificateKey,
        CertificateKey: record.certificateKey,
        UCCode: "",
        SelectedCodes: "",
        MultipleCodes: "",
        RejectionReason: record.reason, // Add rejection reason as a field
      }));

      // Combine all records
      const allCsvRows = [...readyCsvRows];

      if (allCsvRows.length === 0) {
        throw new Error("No records to process");
      }

      // Process the records
      const result = await processCSV(
        allCsvRows,
        (progress) => {
          setCurrentProgress(progress);
        },
      );

      setSummary(result);
      setState("country-interop-results");
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unknown error occurred";

      setState("error");
      setErrorMessage(errorMsg);
    }
  };

  const handleReturnToCountryInteropUpload = () => {
    setState("country-interop-no-records");
    setCurrentProgress(undefined);
    setSummary(null);
    setErrorMessage("");
  };

  return (
    <MantineProvider>
      <div className="max-h-full bg-white">

        {state === "country-interop-upload" && (
          <CountryInteropUploadScreen
            readyRecords={mockReadyRecords}
            rejectedRecords={[]}
            onProcessRecords={handleProcessDatabaseRecords}
          />
        )}

        {state === "country-interop-processing" && (
          <CountryInteropProcessingScreen
            currentProgress={currentProgress}
          />
        )}

        {state === "country-interop-results" && summary && (
          <CountryInteropResultsScreen
            summary={summary}
            rejectedRecords={[]}
            onReturnToUpload={handleReturnToCountryInteropUpload}
          />
        )}

        {state === "country-interop-no-records" && (
          <CountryInteropNoRecordsScreen />
        )}
      </div>
    </MantineProvider>
  );
}