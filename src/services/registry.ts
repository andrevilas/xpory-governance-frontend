import { api } from './api';

export type RegistryRunResult = {
  stacks: number;
  drifted: number;
};

export type RegistryRun = {
  id: string;
  status: string;
  stacksCount: number;
  error: string | null;
  createdAt: string;
};

export type RegistryImageState = {
  stackId: string;
  instanceId: string;
  image: string;
  tag: string;
  digest: string | null;
  registryDigest: string | null;
  drifted: boolean;
  lastSeenAt: string;
};

export type RegistryUpdateResult = {
  instanceId: string | null;
  stackId: number;
  endpointId: number;
  dryRun: boolean;
  status: 'success' | 'failed' | 'dry_run';
  errors: string[];
  rollbackApplied: boolean;
  refreshLog?: Array<{
    image: string;
    tag: string;
    removed: boolean;
    pulled: boolean;
    errors: string[];
  }>;
};

export async function runRegistry(): Promise<RegistryRunResult> {
  const response = await api.post<RegistryRunResult>('/registry/run');
  return response.data;
}

export async function fetchRegistryRuns(limit = 10): Promise<RegistryRun[]> {
  const response = await api.get<RegistryRun[]>('/registry/runs', {
    params: { limit },
  });
  return response.data;
}

export async function fetchStackRegistryImages(stackId: string): Promise<RegistryImageState[]> {
  const response = await api.get<RegistryImageState[]>(`/registry/stacks/${stackId}/images`);
  return response.data;
}

export async function fetchInstanceRegistryImages(instanceId: string): Promise<RegistryImageState[]> {
  const response = await api.get<RegistryImageState[]>(`/registry/instances/${instanceId}/images`);
  return response.data;
}

export async function updateRegistryStack(
  stackId: string,
  payload: { dryRun?: boolean; userId?: string } = {},
): Promise<RegistryUpdateResult> {
  const response = await api.post<RegistryUpdateResult>(`/registry/stacks/${stackId}/update`, payload);
  return response.data;
}
