import { DatabaseRecord, DeathRecord, RejectedRecord } from "./types";


// Mock OpenCRVS database
// In a real implementation, this would be API calls to the OpenCRVS system

// Mock database with some sample records
const mockDatabase: Map<string, DeathRecord> = new Map([
  ['TRK-2026-001234', { id: 'TRK-2026-001234', deceased: 'John Doe', causeOfDeath: [], dateOfDeath: '2024-01-15' }],
  ['TRK-2026-002456', { id: 'TRK-2026-002456', deceased: 'Jane Smith', causeOfDeath: [], dateOfDeath: '2024-02-20' }],
  ['TRK-2026-003789', { id: 'TRK-2026-003789', deceased: 'Bob Johnson', causeOfDeath: [], dateOfDeath: '2024-03-10' }],
  ['TRK-2026-004012', { id: 'TRK-2026-004012', deceased: 'Alice Brown', causeOfDeath: [], dateOfDeath: '2024-04-05' }],
  ['TRK-2026-005345', { id: 'TRK-2026-005345', deceased: 'Charlie Wilson', causeOfDeath: [], dateOfDeath: '2024-05-12' }],
]);

export const findRecordById = async (id: string): Promise<DeathRecord | null> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return mockDatabase.get(id) || null;
};

export const updateCauseOfDeath = async (
  id: string,
  causesOfDeath: string[]
): Promise<boolean> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const record = mockDatabase.get(id);
  if (!record) {
    return false;
  }
  
  // Update the record
  record.causeOfDeath = [...new Set([...record.causeOfDeath, ...causesOfDeath])];
  return true;
};


  // Mock database records for country interop
  export const mockReadyRecords: DatabaseRecord[] = [
    {
      trackingId: "TRK-2026-001",
      certificateKey: "TRK-2026-001234",
      ucCode: "I21.9",
      selectedCodes: "E11.9, I10",
      multipleCodes: ""
    },
    {
      trackingId: "TRK-2026-002",
      certificateKey: "TRK-2026-002456",
      ucCode: "J18.9",
      selectedCodes: "J44.0",
      multipleCodes: "I50.9"
    },
    {
      trackingId: "TRK-2026-003",
      certificateKey: "TRK-2026-003789",
      ucCode: "C34.9",
      selectedCodes: "F17.2",
      multipleCodes: ""
    },
    {
      trackingId: "TRK-2026-004",
      certificateKey: "TRK-2026-004012",
      ucCode: "I25.1",
      selectedCodes: "E11.9, E78.5",
      multipleCodes: "I10"
    },
    {
      trackingId: "TRK-2026-005",
      certificateKey: "TRK-2026-005345",
      ucCode: "N18.9",
      selectedCodes: "E11.2, I12.9",
      multipleCodes: ""
    }
  ];

  export const mockRejectedRecords: RejectedRecord[] = [
    {
      trackingId: "TRK-2026-101",
      certificateKey: "TRK-2026-006678",
      reason: "Insufficient information on death certificate"
    },
    {
      trackingId: "TRK-2026-102",
      certificateKey: "TRK-2026-007901",
      reason: "Contradictory cause of death information"
    },
    {
      trackingId: "TRK-2026-103",
      certificateKey: "TRK-2026-008234",
      reason: "Unable to determine underlying cause"
    },
    {
      trackingId: "TRK-2026-104",
      certificateKey: "TRK-2026-009567",
      reason: "Missing required medical documentation"
    }
  ];