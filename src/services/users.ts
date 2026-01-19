import { api } from './api';

export type UserRole = 'admin_master' | 'admin' | 'operator' | 'viewer';

export type UserRecord = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: UserRole;
  isActive?: boolean;
};

export async function listUsers(params?: { search?: string; role?: string; active?: boolean | null }) {
  const response = await api.get<UserRecord[]>('/users', { params });
  return response.data;
}

export async function listRoles() {
  const response = await api.get<Array<{ name: UserRole }>>('/users/roles');
  return response.data;
}

export async function createUser(payload: CreateUserPayload) {
  const response = await api.post<UserRecord>('/users', payload);
  return response.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const response = await api.patch<UserRecord>(`/users/${id}`, payload);
  return response.data;
}

export async function resetUserPassword(id: string) {
  const response = await api.post<{ status: string }>(`/users/${id}/reset-password`);
  return response.data;
}
