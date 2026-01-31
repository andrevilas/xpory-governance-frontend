import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '../auth/useAuth';
import { ActionDto, ActionStatus, fetchAction } from '../../services/actions';

const POLL_INTERVAL_MS = 10_000;

type ActionNotification = ActionDto & {
  stackName?: string | null;
  instanceLabel?: string | null;
};

type TrackActionInput = ActionDto & {
  stackName?: string | null;
  instanceLabel?: string | null;
};

type ActionNotificationsContextValue = {
  actions: ActionNotification[];
  trackAction: (action: TrackActionInput) => void;
  subscribeAction: (actionId: string) => void;
  dismissAction: (actionId: string) => void;
};

export const ActionNotificationsContext = createContext<ActionNotificationsContextValue | undefined>(undefined);

type ActionNotificationsProviderProps = {
  children: React.ReactNode;
};

const isPending = (status: ActionStatus) => status === 'queued' || status === 'running';

const resolveWsBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api';
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/api\/?$/, '');
  }
  return window.location.origin;
};

export function ActionNotificationsProvider({ children }: ActionNotificationsProviderProps): JSX.Element {
  const { token, userId } = useAuth();
  const [actions, setActions] = useState<ActionNotification[]>([]);
  const actionsRef = useRef<ActionNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const dismissTimersRef = useRef(new Map<string, number>());

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const upsertAction = useCallback((incoming: ActionDto, meta?: Partial<ActionNotification>) => {
    setActions((prev) => {
      const index = prev.findIndex((item) => item.id === incoming.id);
      const existing = index >= 0 ? prev[index] : null;
      const merged: ActionNotification = {
        ...(existing ?? {}),
        ...incoming,
        stackName: meta?.stackName ?? existing?.stackName ?? null,
        instanceLabel: meta?.instanceLabel ?? existing?.instanceLabel ?? null,
      };
      if (index >= 0) {
        const next = [...prev];
        next[index] = merged;
        return next;
      }
      return [merged, ...prev].slice(0, 8);
    });
  }, []);

  const dismissAction = useCallback((actionId: string) => {
    const timer = dismissTimersRef.current.get(actionId);
    if (timer) {
      window.clearTimeout(timer);
      dismissTimersRef.current.delete(actionId);
    }
    setActions((prev) => prev.filter((item) => item.id !== actionId));
  }, []);

  const subscribeAction = useCallback((actionId: string) => {
    socketRef.current?.emit('actions:subscribe', { actionId });
  }, []);

  const trackAction = useCallback(
    (action: TrackActionInput) => {
      upsertAction(action, {
        stackName: action.stackName ?? null,
        instanceLabel: action.instanceLabel ?? null,
      });
      subscribeAction(action.id);
    },
    [subscribeAction, upsertAction],
  );

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dismissTimersRef.current.clear();
      setActions([]);
      return;
    }

    const socket = io(resolveWsBaseUrl(), {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      actionsRef.current
        .filter((action) => isPending(action.status))
        .forEach((action) => socket.emit('actions:subscribe', { actionId: action.id }));
    });

    socket.on('action.created', (payload: ActionDto) => {
      if (payload.userId && userId && payload.userId !== userId) {
        return;
      }
      upsertAction(payload);
    });

    socket.on('action.update', (payload: ActionDto) => {
      if (payload.userId && userId && payload.userId !== userId) {
        return;
      }
      upsertAction(payload);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, upsertAction, userId]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const timer = setInterval(async () => {
      const pending = actionsRef.current.filter((action) => isPending(action.status));
      if (pending.length === 0) {
        return;
      }
      const updates = await Promise.all(
        pending.map((action) =>
          fetchAction(action.id)
            .then((result) => ({ result, meta: action }))
            .catch(() => null)
        )
      );
      updates.forEach((update) => {
        if (!update) {
          return;
        }
        upsertAction(update.result, {
          stackName: update.meta.stackName ?? null,
          instanceLabel: update.meta.instanceLabel ?? null,
        });
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [token, upsertAction]);

  useEffect(() => {
    actions.forEach((action) => {
      const finished = action.status === 'success' || action.status === 'failed';
      const existingTimer = dismissTimersRef.current.get(action.id);
      if (finished && !existingTimer) {
        const timer = window.setTimeout(() => {
          dismissAction(action.id);
        }, 10_000);
        dismissTimersRef.current.set(action.id, timer);
      }
      if (!finished && existingTimer) {
        window.clearTimeout(existingTimer);
        dismissTimersRef.current.delete(action.id);
      }
    });
  }, [actions, dismissAction]);

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      dismissTimersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ actions, trackAction, subscribeAction, dismissAction }), [actions, trackAction, subscribeAction, dismissAction]);

  return (
    <ActionNotificationsContext.Provider value={value}>
      {children}
    </ActionNotificationsContext.Provider>
  );
}
