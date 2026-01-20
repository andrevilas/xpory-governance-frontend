import { api } from './api';

export type PortainerEndpoint = {
  id: number;
  name: string;
  url?: string;
};

export type PortainerStack = {
  instanceId: string;
  id: number;
  name: string;
  endpointId: number;
  status?: number;
  type?: number;
};

export async function fetchEndpoints(instanceId?: string): Promise<PortainerEndpoint[]> {
  const response = await api.get<PortainerEndpoint[]>('/portainer/endpoints', {
    params: instanceId ? { instanceId } : undefined,
  });
  return response.data;
}

export async function fetchStacks(instanceId?: string, endpointId?: number): Promise<PortainerStack[]> {
  const response = await api.get<PortainerStack[]>('/portainer/stacks', {
    params: endpointId || instanceId ? { endpointId, instanceId } : undefined,
  });
  return response.data;
}

export async function fetchInstanceStacks(instanceId: string, endpointId?: number): Promise<PortainerStack[]> {
  const response = await api.get<PortainerStack[]>(`/instances/${instanceId}/stacks`, {
    params: endpointId ? { endpointId } : undefined,
  });
  return response.data;
}

export async function fetchInstanceStackCompose(
  instanceId: string,
  stackId: number,
  endpointId: number,
): Promise<string> {
  const response = await api.get<string>(`/instances/${instanceId}/stacks/${stackId}/compose`, {
    params: { endpointId },
  });
  return response.data;
}
