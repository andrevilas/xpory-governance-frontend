import { api } from './api';

export type NotificationLog = {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  message: string;
  status: string;
  providerResponse: string | null;
  ruleId?: string | null;
  eventType?: string | null;
  severity?: string | null;
  createdAt: string;
};

export async function fetchNotificationLogs(params?: {
  channel?: string;
  status?: string;
  limit?: number;
}): Promise<NotificationLog[]> {
  const response = await api.get<NotificationLog[]>('/notifications/logs', { params });
  return response.data;
}
