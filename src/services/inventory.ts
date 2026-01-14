import { api } from './api';

export type InventorySummary = {
  stacks: number;
  endpoints: number;
  outdatedStacks: number;
  lastAuditAt: string | null;
};

export type InventoryStack = {
  id: string;
  portainerStackId: number;
  endpointId: number;
  name: string;
  status: number | null;
  type: number | null;
  lastSnapshotAt: string | null;
  outdated: boolean;
};

export async function fetchInventorySummary(): Promise<InventorySummary> {
  const response = await api.get<InventorySummary>('/inventory/summary');
  return response.data;
}

export async function fetchInventoryStacks(): Promise<InventoryStack[]> {
  const response = await api.get<InventoryStack[]>('/inventory/stacks');
  return response.data;
}
