import { MantineProvider } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import '../styles/mantine.css'
import { CountryInteropUploadScreen } from '../components/pages/CountryInteropUploadScreen'
import { ProcessingSummary, SpcCodingDatabaseRecord  } from '../util/types'
import { processRecords } from '../util/recordProccessor'
import { CountryInteropProcessingScreen } from '../components/pages/CountryInteropProcessingScreen'
import { CountryInteropResultsScreen } from '../components/pages/CountryInteropResultsScreen'
import { getSPCCodedRecords } from '../services/recordService'
import { CountryInteropNoRecordsScreen } from '../components/pages/CountryInteropNoRecordsScreen'

type AppState =  "country-interop-upload" | "country-interop-no-records" | "country-interop-processing" | "country-interop-results" | "error";

export const Route = createFileRoute('/')({
  component: HomeComponent
})

function HomeComponent() {
  const [state, setState] = useState<AppState>("country-interop-upload");
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentTrackingId: ''
  })
  const [summary, setSummary] =
    useState<ProcessingSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

 const [records, setRecords] = useState<SpcCodingDatabaseRecord[] | []>([]);

useEffect(() => {
  async function loadRecords() {
    const records = await getSPCCodedRecords()
    setRecords(records)
  }
  loadRecords()
}, [])

  const handleProcessDatabaseRecords = async (readyRecords: SpcCodingDatabaseRecord[], rejectedRecords: SpcCodingDatabaseRecord[]) => {
    try {
      setState("country-interop-processing");
      setErrorMessage("");

      if (readyRecords.length === 0) {
        setState("country-interop-processing");
      }

      // Process the records
      const result = await processRecords(
        readyRecords,
        (current, total, currentTrackingId) => {
          setProgress({ current, total, currentTrackingId });
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
    setState("country-interop-upload");
    setProgress({
    current: 0,
    total: 0,
    currentTrackingId: ''
  })
    setSummary(null);
    setErrorMessage("");
  };

  return (
    <MantineProvider>
      <div className="max-h-full bg-white">

        {state === "country-interop-upload" && (
          <CountryInteropUploadScreen
            readyRecords={records.filter(record => record.status === 'completed')}
            rejectedRecords={records.filter(record => record.status === 'rejected')}
            onProcessRecords={handleProcessDatabaseRecords}
          />
        )}

        {state === "country-interop-processing" && (
          <CountryInteropProcessingScreen
            currentProgress={progress}
          />
        )}

        {state === "country-interop-results" && summary && (
          <CountryInteropResultsScreen
            summary={summary}
            rejectedRecords={records.filter(record => record.status === 'rejected')}
            onReturnToUpload={handleReturnToCountryInteropUpload}
          />
        )}

        {state === "country-interop-no-records" && (
          <CountryInteropNoRecordsScreen />
        )}

        {/* TODO: Add error handling screen */}
      </div>
    </MantineProvider>
  );
}