import { api } from './api';

export type InventorySummary = {
  stacks: number;
  instances: number;
  endpoints: number;
  outdatedStacks: number;
  instanceDriftedStacks: number;
  lastAuditAt: string | null;
};

export type InventoryStack = {
  id: string;
  instanceId: string | null;
  instanceName: string | null;
  portainerStackId: number;
  endpointId: number;
  name: string;
  status: number | null;
  type: number | null;
  lastSnapshotAt: string | null;
  outdated: boolean;
  drifted: boolean;
  instanceDrifted: boolean;
};

export async function fetchInventorySummary(): Promise<InventorySummary> {
  const response = await api.get<InventorySummary>('/inventory/summary');
  return response.data;
}

export async function fetchInventoryStacks(): Promise<InventoryStack[]> {
  const response = await api.get<InventoryStack[]>('/inventory/stacks');
  return response.data;
}

export async function runInventory(): Promise<{ stacks: number }> {
  const response = await api.post<{ stacks: number }>('/inventory/run');
  return response.data;
}

export type JobRun = {
  id: string;
  jobType: string;
  status: string;
  stacksCount: number;
  error: string | null;
  createdAt: string;
};

export async function fetchInventoryRuns(limit = 10): Promise<JobRun[]> {
  const response = await api.get<JobRun[]>('/inventory/runs', {
    params: { limit },
  });
  return response.data;
}
