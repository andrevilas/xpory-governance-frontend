import { api } from './api';

export type AuditResult = {
  id: string;
  stackUuid: string;
  image: string;
  currentTag: string;
  latestTag: string;
  updateAvailable: boolean;
  createdAt: string;
};

export async function fetchAuditResults(stackUuid: string): Promise<AuditResult[]> {
  const response = await api.get<AuditResult[]>(`/audit/stacks/${stackUuid}`);
  return response.data;
}
