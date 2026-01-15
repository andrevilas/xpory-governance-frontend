import { api } from './api';

export type PortainerInstance = {
  id: string;
  name: string;
  baseUrl: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePortainerInstance = {
  name: string;
  baseUrl: string;
  token: string;
  username?: string;
  password?: string;
  environment: string;
  validateConnection?: boolean;
};

export type UpdatePortainerInstance = {
  name?: string;
  baseUrl?: string;
  token?: string;
  username?: string;
  password?: string;
  environment?: string;
  validateConnection?: boolean;
};

export async function fetchInstances(): Promise<PortainerInstance[]> {
  const response = await api.get<PortainerInstance[]>('/instances');
  return response.data;
}

export async function createInstance(payload: CreatePortainerInstance): Promise<PortainerInstance> {
  const response = await api.post<PortainerInstance>('/instances', payload);
  return response.data;
}

export async function updateInstance(id: string, payload: UpdatePortainerInstance): Promise<PortainerInstance> {
  const response = await api.put<PortainerInstance>(`/instances/${id}`, payload);
  return response.data;
}

export async function deleteInstance(id: string): Promise<void> {
  await api.delete(`/instances/${id}`);
}
