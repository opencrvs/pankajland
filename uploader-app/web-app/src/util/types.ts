export type Role = 'Registrar'


export interface ProcessingResult {
  rowIndex: number;
  id: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  causesOfDeath?: string;
  irisRejectionReason?: string;
  createdBy?: string | null;
  /** The tracking ID of the record for display in emails */
  trackingId?: string
}

export interface RecordsToEmail {
  status: 'success' | 'skipped' | 'error'
  /** The tracking ID of the record for display in emails */
  trackingId?: string
  /** The uc code of the record for display in emails */
  ucCode?: string
}

export interface ProcessingSummary {
  total: number;
  successful: number;
  skipped: number;
  errors: number;
  results: ProcessingResult[];
}

/**
 * User information for email notifications
 */
export interface UserInfo {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface ProcessingProgress {
  current: number;
  total: number;
  currentTrackingId: string;
}

export interface SpcCodingDatabaseRecord {
  trackingId: string
  status: string
  ucCode: string
  selectedCodes: string[]
  multipleCodes: string[]
  freeText: string
  comments: string
  processedBySystem: string
}