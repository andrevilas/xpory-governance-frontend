import { api } from './api';

export type UpdateResponse = {
  instanceId: string | null;
  stackId: number;
  endpointId: number;
  dryRun: boolean;
  steps: Record<string, boolean>;
  errors: string[];
  rollbackApplied: boolean;
};

export async function fetchCompose(
  instanceId: string | null,
  stackId: number,
  endpointId: number,
): Promise<string> {
  const response = await api.get<string>(`/portainer/stacks/${stackId}/compose`, {
    params: { endpointId, instanceId: instanceId ?? undefined },
  });
  return response.data;
}

export async function executeUpdate(
  instanceId: string | null,
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
    params: { endpointId, instanceId: instanceId ?? undefined },
  });
  return response.data;
}
