import { api } from './api';

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/auth/change-password', payload);
  return response.data;
}
