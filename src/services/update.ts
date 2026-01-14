import { api } from './api';

export type UpdateResponse = {
  stackId: number;
  endpointId: number;
  dryRun: boolean;
  steps: Record<string, boolean>;
  errors: string[];
  rollbackApplied: boolean;
};

export async function fetchCompose(stackId: number, endpointId: number): Promise<string> {
  const response = await api.get<string>(`/portainer/stacks/${stackId}/compose`, {
    params: { endpointId },
  });
  return response.data;
}

export async function executeUpdate(
  stackId: number,
  endpointId: number,
  composeYaml: string,
  dryRun: boolean,
): Promise<UpdateResponse> {
  const response = await api.post<UpdateResponse>(`/stacks/${stackId}/update`, {
    composeYaml,
    dryRun,
    endpointId,
  }, {
    params: { endpointId },
  });
  return response.data;
}
