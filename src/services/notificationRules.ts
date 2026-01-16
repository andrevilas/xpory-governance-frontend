import { api } from './api';

export type NotificationRecipient = {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRule = {
  id: string;
  name: string;
  eventType: string;
  severity?: string | null;
  enabled: boolean;
  throttleMinutes: number;
  recipients: string[];
  createdAt: string;
  updatedAt: string;
};

export async function fetchNotificationRecipients(): Promise<NotificationRecipient[]> {
  const response = await api.get<NotificationRecipient[]>('/notifications/recipients');
  return response.data;
}

export async function createNotificationRecipient(payload: {
  name: string;
  channel: 'email' | 'sms';
  address: string;
  active?: boolean;
}): Promise<NotificationRecipient> {
  const response = await api.post<NotificationRecipient>('/notifications/recipients', payload);
  return response.data;
}

export async function updateNotificationRecipient(
  id: string,
  payload: Partial<Omit<NotificationRecipient, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<NotificationRecipient | null> {
  const response = await api.put<NotificationRecipient | null>(`/notifications/recipients/${id}`, payload);
  return response.data;
}

export async function deleteNotificationRecipient(id: string): Promise<void> {
  await api.delete(`/notifications/recipients/${id}`);
}

export async function fetchNotificationRules(): Promise<NotificationRule[]> {
  const response = await api.get<NotificationRule[]>('/notifications/rules');
  return response.data;
}

export async function createNotificationRule(payload: {
  name: string;
  eventType: string;
  severity?: string | null;
  enabled?: boolean;
  throttleMinutes?: number;
  recipients: string[];
}): Promise<NotificationRule> {
  const response = await api.post<NotificationRule>('/notifications/rules', payload);
  return response.data;
}

export async function updateNotificationRule(
  id: string,
  payload: Partial<Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<NotificationRule | null> {
  const response = await api.put<NotificationRule | null>(`/notifications/rules/${id}`, payload);
  return response.data;
}

export async function deleteNotificationRule(id: string): Promise<void> {
  await api.delete(`/notifications/rules/${id}`);
}
