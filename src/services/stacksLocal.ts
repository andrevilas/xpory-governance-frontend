import { api } from './api';

export type StackLocal = {
  id: string;
  name: string;
  description?: string | null;
  composeTemplate: string;
  currentVersion?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StackLocalVariable = {
  id: string;
  stackId: string;
  variableName: string;
  description?: string | null;
  defaultValue?: string | null;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StackLocalVersion = {
  id: string;
  stackId: string;
  version: string;
  description?: string | null;
  composeTemplate: string;
  createdAt: string;
  createdBy?: string | null;
};

export type StackLocalPreview = {
  stackId: string;
  instanceId: string;
  resolvedTemplate: string;
  missingVariables: string[];
  unknownVariables: string[];
  isValid: boolean;
};

export type StackInstanceVariable = {
  stackId: string;
  instanceId: string;
  variableName: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type DeployStackLocalRequest = {
  instanceIds: string[];
  dryRun?: boolean;
  userId?: string;
  targetVersion?: string;
};

export type RedeployStackLocalRequest = {
  instanceIds: string[];
  userId?: string;
};

export type DeployStackLocalResult = {
  instanceId: string;
  portainerStackId: number | null;
  endpointId: number | null;
  status: 'success' | 'failed' | 'dry_run';
  message: string;
  errors: string[];
  rollbackApplied: boolean;
};

export const fetchStacksLocal = async (): Promise<StackLocal[]> => {
  const { data } = await api.get('/stacks/local');
  return data;
};

export const createStackLocal = async (payload: {
  name: string;
  description?: string;
  composeTemplate: string;
  currentVersion?: string;
}): Promise<StackLocal> => {
  const { data } = await api.post('/stacks/local', payload);
  return data;
};

export const updateStackLocal = async (
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    composeTemplate?: string;
    currentVersion?: string | null;
  },
): Promise<StackLocal> => {
  const { data } = await api.put(`/stacks/local/${id}`, payload);
  return data;
};

export const deleteStackLocal = async (id: string): Promise<void> => {
  await api.delete(`/stacks/local/${id}`);
};

export const fetchStackLocalVariables = async (stackId: string): Promise<StackLocalVariable[]> => {
  const { data } = await api.get(`/stacks/local/${stackId}/variables`);
  return data;
};

export const createStackLocalVariable = async (
  stackId: string,
  payload: {
    variableName: string;
    description?: string;
    defaultValue?: string;
    isRequired?: boolean;
  },
): Promise<StackLocalVariable> => {
  const { data } = await api.post(`/stacks/local/${stackId}/variables`, payload);
  return data;
};

export const updateStackLocalVariable = async (
  stackId: string,
  variableId: string,
  payload: {
    variableName?: string;
    description?: string | null;
    defaultValue?: string | null;
    isRequired?: boolean;
  },
): Promise<StackLocalVariable> => {
  const { data } = await api.put(`/stacks/local/${stackId}/variables/${variableId}`, payload);
  return data;
};

export const deleteStackLocalVariable = async (stackId: string, variableId: string): Promise<void> => {
  await api.delete(`/stacks/local/${stackId}/variables/${variableId}`);
};

export const fetchStackLocalVersions = async (stackId: string): Promise<StackLocalVersion[]> => {
  const { data } = await api.get(`/stacks/local/${stackId}/versions`);
  return data;
};

export const createStackLocalVersion = async (
  stackId: string,
  payload: {
    version: string;
    description?: string;
    composeTemplate?: string;
    createdBy?: string;
  },
): Promise<StackLocalVersion> => {
  const { data } = await api.post(`/stacks/local/${stackId}/versions`, payload);
  return data;
};

export const fetchStackLocalPreview = async (
  stackId: string,
  instanceId: string,
  version?: string,
): Promise<StackLocalPreview> => {
  const params = version ? { version } : undefined;
  const { data } = await api.get(`/stacks/local/${stackId}/preview/${instanceId}`, { params });
  return data;
};

export const fetchStackInstanceVariables = async (
  stackId: string,
  instanceId: string,
): Promise<StackInstanceVariable[]> => {
  const { data } = await api.get(`/stacks/local/${stackId}/instances/${instanceId}/variables`);
  return data;
};

export const upsertInstanceVariable = async (
  stackId: string,
  instanceId: string,
  variableName: string,
  value: string,
): Promise<StackInstanceVariable> => {
  const { data } = await api.put(`/stacks/local/${stackId}/instances/${instanceId}/variables/${variableName}`, {
    value,
  });
  return data;
};

export const deleteInstanceVariable = async (
  stackId: string,
  instanceId: string,
  variableName: string,
): Promise<void> => {
  await api.delete(`/stacks/local/${stackId}/instances/${instanceId}/variables/${variableName}`);
};

export const deployStackLocal = async (
  stackId: string,
  payload: DeployStackLocalRequest,
): Promise<DeployStackLocalResult[]> => {
  const { data } = await api.post(`/stacks/local/${stackId}/deploy`, payload);
  return data;
};

export const redeployStackLocal = async (
  stackId: string,
  payload: RedeployStackLocalRequest,
): Promise<DeployStackLocalResult[]> => {
  const { data } = await api.post(`/stacks/local/${stackId}/redeploy`, payload);
  return data;
};
