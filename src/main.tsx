import React from 'react';
import ReactDOM from 'react-dom/client';

import { AuthProvider } from './context/auth/AuthContext';
import { ActionNotificationsProvider } from './context/actions/ActionNotificationsContext';
import { AppRouter } from './router/AppRouter';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ActionNotificationsProvider>
        <AppRouter />
      </ActionNotificationsProvider>
    </AuthProvider>
  </React.StrictMode>
);
