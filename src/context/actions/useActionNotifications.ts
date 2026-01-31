import { useContext } from 'react';

import { ActionNotificationsContext } from './ActionNotificationsContext';

export function useActionNotifications() {
  const context = useContext(ActionNotificationsContext);
  if (!context) {
    throw new Error('useActionNotifications deve ser usado dentro de ActionNotificationsProvider');
  }
  return context;
}
