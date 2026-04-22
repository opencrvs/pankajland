import Papa from 'papaparse';
import { CSVRow, ProcessingResult, ProcessingSummary, ProcessingProgress } from './types';
import { findRecordById, updateCauseOfDeath } from './mockOpenCRVS';

const REQUIRED_HEADERS = ['UCCode', 'SelectedCodes', 'MultipleCodes', 'CertificateKey'];

export const validateCSVHeaders = (headers: string[]): { isValid: boolean; missingHeaders: string[] } => {
  const missingHeaders = REQUIRED_HEADERS.filter(
    required => !headers.includes(required)
  );
  
  return {
    isValid: missingHeaders.length === 0,
    missingHeaders
  };
};

export const parseCSV = (file: File): Promise<CSVRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('CSV parsing failed: ' + results.errors[0].message));
          return;
        }
        
        if (results.data.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        // Validate headers
        const headers = Object.keys(results.data[0]);
        const validation = validateCSVHeaders(headers);
        
        if (!validation.isValid) {
          reject(new Error(
            `CSV format is incorrect. Missing required headers: ${validation.missingHeaders.join(', ')}`
          ));
          return;
        }
        
        resolve(results.data);
      },
      error: (error) => {
        reject(new Error('Failed to parse CSV: ' + error.message));
      },
    });
  });
};

const extractCausesOfDeath = (row: CSVRow): string[] => {
  const causes: string[] = [];
  
  // Extract from UCCode
  if (row.UCCode?.trim()) {
    causes.push(row.UCCode.trim());
  }
  
  // Extract from SelectedCodes (may contain multiple codes separated by comma/semicolon)
  if (row.SelectedCodes?.trim()) {
    const codes = row.SelectedCodes.split(/[,;]/).map(c => c.trim()).filter(c => c);
    causes.push(...codes);
  }
  
  // Extract from MultipleCodes (may contain multiple codes separated by comma/semicolon)
  if (row.MultipleCodes?.trim()) {
    const codes = row.MultipleCodes.split(/[,;]/).map(c => c.trim()).filter(c => c);
    causes.push(...codes);
  }
  
  return causes;
};

export const processCSVRow = async (
  row: CSVRow,
  rowIndex: number,
  onStepUpdate?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> => {
  const id = row.CertificateKey?.trim();
  
  if (!id) {
    return {
      rowIndex,
      id: '',
      status: 'error',
      message: 'Row is missing a CertificateKey',
    };
  }
  
  try {
    // Step 1: Finding record in DB
    if (onStepUpdate) {
      onStepUpdate({
        current: rowIndex,
        total: 0, // Will be set by caller
        currentCertificateKey: id,
        currentStep: 'finding',
        stepDescription: 'Finding record in database...'
      });
    }
    
    const record = await findRecordById(id);
    
    if (!record) {
      return {
        rowIndex,
        id,
        status: 'skipped',
        message: `Record with ID "${id}" not found in database`,
      };
    }
    
    // Step 2: Checking status
    if (onStepUpdate) {
      onStepUpdate({
        current: rowIndex,
        total: 0,
        currentCertificateKey: id,
        currentStep: 'checking',
        stepDescription: 'Checking record status...'
      });
    }
    
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
    
    // Step 3: Deciding action
    if (onStepUpdate) {
      onStepUpdate({
        current: rowIndex,
        total: 0,
        currentCertificateKey: id,
        currentStep: 'deciding',
        stepDescription: 'Updating record...'
      });
    }
    
    // Update the record with the cause of death codes
    const updated = await updateCauseOfDeath(id, causesOfDeath);
    
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

export const processCSV = async (
  rows: CSVRow[],
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingSummary> => {
  const results: ProcessingResult[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const result = await processCSVRow(
      rows[i], 
      i + 1,
      (stepProgress) => {
        if (onProgress) {
          onProgress({
            ...stepProgress,
            total: rows.length
          });
        }
      }
    );
    results.push(result);
  }
  
  const summary: ProcessingSummary = {
    total: results.length,
    successful: results.filter(r => r.status === 'success').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  };
  
  return summary;
};