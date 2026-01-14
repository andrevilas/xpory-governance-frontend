import { api } from './api';

export type PortainerEndpoint = {
  id: number;
  name: string;
  url?: string;
};

export type PortainerStack = {
  id: number;
  name: string;
  endpointId: number;
  status?: number;
  type?: number;
};

export async function fetchEndpoints(): Promise<PortainerEndpoint[]> {
  const response = await api.get<PortainerEndpoint[]>('/portainer/endpoints');
  return response.data;
}

export async function fetchStacks(endpointId?: number): Promise<PortainerStack[]> {
  const response = await api.get<PortainerStack[]>('/portainer/stacks', {
    params: endpointId ? { endpointId } : undefined,
  });
  return response.data;
}
