import { api } from './api';

export type ActionStatus = 'queued' | 'running' | 'success' | 'failed';

export type ActionType = 'redeploy_stack' | 'remove_stack' | 'update_stack';

export type ActionDto = {
  id: string;
  type: ActionType;
  status: ActionStatus;
  stackId: string | null;
  instanceId: string | null;
  userId: string | null;
  message?: string | null;
  result?: unknown | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ActionResponseDto = {
  actionId: string;
  status: ActionStatus;
};

export async function createRedeployAction(payload: { stackId: string; instanceId: string }): Promise<ActionResponseDto> {
  const response = await api.post<ActionResponseDto>('/actions/redeploy', payload);
  return response.data;
}

export async function createRemoveAction(payload: { stackId: string; instanceId?: string | null }): Promise<ActionResponseDto> {
  const response = await api.post<ActionResponseDto>('/actions/remove', payload);
  return response.data;
}

export async function fetchAction(id: string): Promise<ActionDto> {
  const response = await api.get<ActionDto>(`/actions/${id}`);
  return response.data;
}
