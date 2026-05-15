import { MantineProvider } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import '../styles/mantine.css'
import { ImportScreen } from '../components/pages/ImportScreen'
import { ProcessingSummary, SpcCodingDatabaseRecord  } from '../util/types'
import { ProcessingScreen } from '../components/pages/ProcessingScreen'
import { ResultsScreen } from '../components/pages/ResultsScreen'
import { getPendingSPCRecords, processRecords } from '../services/recordService'

type AppState =  "import" | "processing" | "results" | "error";

export const Route = createFileRoute('/')({
  component: HomeComponent
})

function HomeComponent() {
  const [state, setState] = useState<AppState>("import");
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentTrackingId: ''
  })
  const [summary, setSummary] =
    useState<ProcessingSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

 const [records, setRecords] = useState<SpcCodingDatabaseRecord[] | []>([]);

 const token = localStorage.getItem('authToken')
  if (!token) {
    throw new Error('Authentication token not found. Please log in.')
  }

useEffect(() => {
  if (state !== "import") {
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
      setState("processing");
      setErrorMessage("");

      const result = await processRecords(
        records,
        token,
        (current, total, currentTrackingId) => {
          setProgress({ current, total, currentTrackingId });
        },
      );

      setSummary(result);
      setState("results");
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
    setState("import");
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

        {state === "import" && (
          <ImportScreen
            records={records}
            onProcessRecords={handleProcessDatabaseRecords}
          />
        )}

        {state === "processing" && (
          <ProcessingScreen
            currentProgress={progress}
          />
        )}

        {state === "results" && summary && (
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