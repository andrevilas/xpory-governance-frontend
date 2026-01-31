import { useMemo } from 'react';

import { useActionNotifications } from '../../context/actions/useActionNotifications';
import { ActionStatus, ActionType } from '../../services/actions';
import './action-notifications.css';

const statusLabel: Record<ActionStatus, string> = {
  queued: 'Na fila',
  running: 'Em andamento',
  success: 'Concluída',
  failed: 'Falhou',
};

const typeLabel: Record<ActionType, string> = {
  redeploy_stack: 'Redeploy',
  remove_stack: 'Remoção',
  update_stack: 'Atualização por digest',
};

const formatTime = (value?: string | null) => {
  if (!value) {
    return 'agora';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'agora';
  }
  return parsed.toLocaleString('pt-BR');
};

export function ActionNotificationsPanel(): JSX.Element | null {
  const { actions, dismissAction } = useActionNotifications();

  const visibleActions = useMemo(() => actions.slice(0, 6), [actions]);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className="action-notifications" role="status" aria-live="polite">
      <div className="action-notifications-list">
        {visibleActions.map((action) => {
          const label = typeLabel[action.type] ?? 'Ação';
          const status = statusLabel[action.status] ?? action.status;
          const stackLabel = action.stackName ?? action.stackId ?? 'Stack não identificada';
          const instanceLabel = action.instanceLabel ?? action.instanceId;
          const isPending = action.status === 'queued' || action.status === 'running';
          return (
            <div key={action.id} className={`action-card ${action.status}`}>
              <div className="action-card-header">
                <div>
                  <span className="action-title">Ação: {label}</span>
                  <span className="action-status">{status}</span>
                </div>
                <div className="action-card-actions">
                  {isPending ? (
                    <span className="action-spinner" aria-label="Processando" />
                  ) : action.status === 'success' ? (
                    <span className="action-icon success" aria-label="Concluída">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3 8l3 3 7-7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span className="action-icon failed" aria-label="Falhou">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                  <button type="button" onClick={() => dismissAction(action.id)} aria-label="Remover">
                    ×
                  </button>
                </div>
              </div>
              <div className="action-card-body">
                <div className="action-target">
                  <strong>{stackLabel}</strong>
                  {instanceLabel ? <span>{instanceLabel}</span> : null}
                </div>
                <p>{action.message ?? 'Aguardando atualizações...'}</p>
                <div className="action-meta">
                  <span>{formatTime(action.updatedAt ?? action.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
