import { MantineProvider } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import '../styles/mantine.css'
import { ImportScreen } from '../components/pages/ImportScreen'
import { ProcessingSummary, SpcCodingDatabaseRecord  } from '../util/types'
import { processRecords } from '../util/recordProccessor'
import { ProcessingScreen } from '../components/pages/ProcessingScreen'
import { ResultsScreen } from '../components/pages/ResultsScreen'
import { getPendingSPCRecords } from '../services/recordService'

type AppState =  "country-interop-upload" | "country-interop-processing" | "country-interop-results" | "error";

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
  if (state !== "country-interop-upload") {
    return;
  }
  async function loadRecords() {
    const records = await getPendingSPCRecords()
    setRecords(records)
  }
  loadRecords()
}, [state])

  const handleProcessDatabaseRecords = async (records: SpcCodingDatabaseRecord[]) => {
    try {
      setState("country-interop-processing");
      setErrorMessage("");

      const result = await processRecords(
        records,
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
          <ImportScreen
            records={records}
            onProcessRecords={handleProcessDatabaseRecords}
          />
        )}

        {state === "country-interop-processing" && (
          <ProcessingScreen
            currentProgress={progress}
          />
        )}

        {state === "country-interop-results" && summary && (
          <ResultsScreen
            summary={summary}
            rejectedRecords={records.filter(record => record.status === 'rejected')}
            onReturnToUpload={handleReturnToCountryInteropUpload}
          />
        )}

        {/* TODO: Add error handling screen */}
      </div>
    </MantineProvider>
  );
}