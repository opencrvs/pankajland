import { ProcessingResult, ProcessingSummary, ProcessingProgress, SpcCodingDatabaseRecord } from './types';

const extractCausesOfDeath = (row: SpcCodingDatabaseRecord): string[] => {
  const causes: string[] = [];
  
  // Extract from UCCode
  if (row.ucCode?.trim()) {
    causes.push(row.ucCode.trim());
  }
  
  // Extract from SelectedCodes (may contain multiple codes separated by comma/semicolon)
  if (row.selectedCodes) {
    causes.push(...row.selectedCodes);
  }
  
  // Extract from MultipleCodes (may contain multiple codes separated by comma/semicolon)
  if (row.multipleCodes) {
    causes.push(...row.multipleCodes);
  }
  
  return causes;
};

const correctRecord = async (
  id: string,
  causesOfDeath: string[]
): Promise<boolean> => {
  /* TODO: Implement actual record correction logic */
  await new Promise(resolve => setTimeout(resolve, 4000));
  return true;
};

export const processRecord = async (
  row: SpcCodingDatabaseRecord,
  rowIndex: number,
  onStepUpdate?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> => {
  const id = row.trackingId?.trim();
  
  if (!id) {
    return {
      rowIndex,
      id: '',
      status: 'error',
      message: 'Row is missing a trackingId',
    };
  }
  
  try {
    // Extract cause of death codes from the row
    const causesOfDeath = extractCausesOfDeath(row);
    
    if (causesOfDeath.length === 0) {
      return {
        rowIndex,
        id,
        status: 'skipped',
        message: 'No cause of death codes found in row',
      };
    }
    
    // Correct the record with the cause of death codes
    const updated = await correctRecord(id, causesOfDeath);
    
    if (!updated) {
      return {
        rowIndex,
        id,
        status: 'error',
        message: 'Failed to update record',
      };
    }
    
    return {
      rowIndex,
      id,
      status: 'success',
      message: `Successfully updated with ${causesOfDeath.length} cause(s) of death`,
      causesOfDeath,
    };
  } catch (error) {
    return {
      rowIndex,
      id,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const processRecords = async (
  rows: SpcCodingDatabaseRecord[],
  onProgress?: (current: number, total: number, currentTrackingId: string) => void
): Promise<ProcessingSummary> => {
  const results: ProcessingResult[] = []

  for (let i = 0; i < rows.length; i++) {
    if (onProgress) {
      onProgress(i + 1, rows.length, rows[i].trackingId?.trim() || '')
    }
    const result = await processRecord(rows[i], i + 1)
    results.push(result)

  }

  const summary: ProcessingSummary = {
    total: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    /* rejected: results.filter((r) => r.status === 'rejected').length, */
    results
  }

  console.log('summary :>> ', summary);
 
  // Send email notifications - one email per user with all their processed records
  // await sendEmailNotifications(token, results)

  return summary
};