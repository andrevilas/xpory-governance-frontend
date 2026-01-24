import { api } from './api';

export type AuditResult = {
  id: string;
  stackUuid: string;
  stackName?: string;
  instanceName?: string | null;
  endpointId?: number;
  image: string;
  currentTag: string;
  latestTag: string;
  updateAvailable: boolean;
  riskLevel: string;
  createdAt: string;
};

export async function fetchAuditResults(stackUuid: string): Promise<AuditResult[]> {
  const response = await api.get<AuditResult[]>(`/audit/stacks/${stackUuid}`);
  return response.data;
}

export async function fetchAuditResultsAll(params?: {
  stackUuid?: string;
  stackName?: string;
  instanceName?: string;
  updateAvailable?: boolean;
  riskLevel?: string;
  limit?: number;
}): Promise<AuditResult[]> {
  const response = await api.get<AuditResult[]>('/audit/results', {
    params,
  });
  return response.data;
}

export type AuditSummary = {
  failedRuns: number;
  failedResults: number;
};

export async function fetchAuditSummary(): Promise<AuditSummary> {
  const response = await api.get<AuditSummary>('/audit/summary');
  return response.data;
}

export async function runAudit(): Promise<{ stacks: number }> {
  const response = await api.post<{ stacks: number }>('/audit/run');
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

export async function fetchAuditRuns(limit = 10): Promise<JobRun[]> {
  const response = await api.get<JobRun[]>('/audit/runs', {
    params: { limit },
  });
  return response.data;
}
