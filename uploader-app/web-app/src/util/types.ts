export type Role = 'Registrar'


export interface ProcessingResult {
  rowIndex: number;
  id: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  causesOfDeath?: string[];
}

export interface ProcessingSummary {
  total: number;
  successful: number;
  skipped: number;
  errors: number;
  results: ProcessingResult[];
}

export interface ProcessingProgress {
  current: number;
  total: number;
  currentTrackingId: string;
}

export interface DatabaseRecord {
  trackingId: string;
  certificateKey: string;
  ucCode?: string;
  selectedCodes?: string;
  multipleCodes?: string;
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

export interface RejectedRecord {
  trackingId: string;
  certificateKey: string;
  reason: string;
}

export interface DeathRecord {
  id: string;
  deceased: string;
  causeOfDeath: string[];
  dateOfDeath: string;
}