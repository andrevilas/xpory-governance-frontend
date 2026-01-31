import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppLayout } from '../../components/layout/AppLayout';
import { StackRedeployModal } from '../../components/stacks/StackRedeployModal';
import { Modal } from '../../components/ui/Modal';
import { useActionNotifications } from '../../context/actions/useActionNotifications';
import { createRemoveAction } from '../../services/actions';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { fetchStacksLocal, StackLocal } from '../../services/stacksLocal';
import '../dashboard/dashboard.css';

type StackRow = {
  id: string;
  name: string;
  instanceId: string | null;
  instanceLabel: string;
  instanceName: string | null;
  status: 'ok' | 'warn';
  instanceDrifted: boolean;
  digestDrifted: boolean;
  outdated: boolean;
  removedAt: string | null;
  isAccessible: boolean;
};

const buildGlobalNameSet = (stacksLocal: StackLocal[]): Set<string> =>
  new Set(stacksLocal.map((stack) => stack.name.toLowerCase()));

export function StacksMonitoredPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [stackFilter, setStackFilter] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');
  const [stacksPage, setStacksPage] = useState(1);
  const [stacksPageSize, setStacksPageSize] = useState(10);
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [localStacks, setLocalStacks] = useState<StackLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [digestOnlyFilter, setDigestOnlyFilter] = useState(searchParams.get('digestDrift') === 'true');
  const [instanceDriftOnly, setInstanceDriftOnly] = useState(
    searchParams.get('instanceDrift') === 'true',
  );
  const [attentionOnly, setAttentionOnly] = useState(searchParams.get('attention') === 'true');
  const [globalOnly, setGlobalOnly] = useState(searchParams.get('globalOnly') !== 'false');
  const [redeployTarget, setRedeployTarget] = useState<InventoryStack | null>(null);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const [selected, setSelected] = useState<StackRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StackRow | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const { trackAction, subscribeAction } = useActionNotifications();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stacksResult, stacksLocalResult] = await Promise.all([
        fetchInventoryStacks(showRemoved),
        fetchStacksLocal(),
      ]);
      setLocalStacks(stacksLocalResult ?? []);
      if (globalOnly) {
        const globalNames = buildGlobalNameSet(stacksLocalResult ?? []);
        setStacks(stacksResult.filter((stack) => globalNames.has(stack.name.toLowerCase())));
      } else {
        setStacks(stacksResult);
      }
    } catch (err) {
      void err;
      setError('Não foi possível carregar as stacks monitoradas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [showRemoved, globalOnly]);

  const stackRows = useMemo<StackRow[]>(() => {
    return stacks.map((stack) => ({
      id: stack.id,
      name: stack.name,
      instanceId: stack.instanceId,
      status: stack.outdated || stack.instanceDrifted || stack.digestDrifted ? 'warn' : 'ok',
      instanceLabel: stack.instanceName ?? `Endpoint ${stack.endpointId}`,
      instanceName: stack.instanceName,
      instanceDrifted: stack.instanceDrifted,
      digestDrifted: stack.digestDrifted,
      outdated: stack.outdated,
      removedAt: stack.removedAt,
      isAccessible: stack.status === 1 && !stack.removedAt,
    }));
  }, [stacks]);

  const globalStackNames = useMemo(
    () => new Set(localStacks.map((stack) => stack.name.toLowerCase())),
    [localStacks],
  );

  const handleOpenRedeploy = (row: StackRow) => {
    const target = stacks.find((stack) => stack.id === row.id) ?? null;
    setRedeployTarget(target);
    setRedeployOpen(true);
  };

  const stackOptions = useMemo(() => {
    const names = new Set<string>();
    stackRows.forEach((row) => names.add(row.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stackRows]);

  const instanceOptions = useMemo(() => {
    const names = new Set<string>();
    stackRows.forEach((row) => {
      if (row.instanceName) {
        names.add(row.instanceName);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stackRows]);

  const filteredStacks = useMemo(() => {
    let filtered = stackRows;
    if (stackFilter) {
      filtered = filtered.filter((row) => row.name === stackFilter);
    }
    if (instanceFilter) {
      filtered = filtered.filter((row) => row.instanceName === instanceFilter);
    }
    if (attentionOnly) {
      filtered = filtered.filter((row) => row.outdated || row.instanceDrifted || row.digestDrifted);
    }
    if (instanceDriftOnly) {
      filtered = filtered.filter((row) => row.instanceDrifted);
    }
    if (digestOnlyFilter) {
      filtered = filtered.filter((row) => row.digestDrifted);
    }
    return filtered;
  }, [stackRows, stackFilter, instanceFilter, attentionOnly, instanceDriftOnly, digestOnlyFilter]);

  useEffect(() => {
    setStacksPage(1);
  }, [stackFilter, instanceFilter, attentionOnly, instanceDriftOnly, digestOnlyFilter, showRemoved]);

  const stacksTotalPages = Math.max(1, Math.ceil(filteredStacks.length / stacksPageSize));
  const pagedStacks = useMemo(() => {
    const start = (stacksPage - 1) * stacksPageSize;
    return filteredStacks.slice(start, start + stacksPageSize);
  }, [filteredStacks, stacksPage, stacksPageSize]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadData();
    } catch (err) {
      void err;
      setError('Não foi possível atualizar agora. Tente novamente em instantes.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }
    setRemoveLoading(true);
    try {
      const response = await createRemoveAction({
        stackId: removeTarget.id,
        instanceId: removeTarget.instanceId,
      });
      trackAction({
        id: response.actionId,
        type: 'remove_stack',
        status: response.status,
        stackId: removeTarget.id,
        instanceId: removeTarget.instanceId,
        userId: null,
        message: 'Remoção enfileirada',
        result: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stackName: removeTarget.name,
        instanceLabel: removeTarget.instanceLabel,
      });
      subscribeAction(response.actionId);
      setToastMessage('Remoção enfileirada');
      setRemoveTarget(null);
      setRemoveConfirm('');
    } catch (err) {
      const apiMessage =
        typeof err === 'object' && err !== null
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const message = apiMessage || (err instanceof Error ? err.message : 'Falha ao remover stack');
      setToastMessage(message);
    } finally {
      setRemoveLoading(false);
    }
  };

  const canConfirmRemove = removeConfirm.trim().toLowerCase() === 'remover';

  return (
    <AppLayout
      title="Stacks monitoradas"
      headerAction={
        <>
          <label className="filter-toggle header-toggle">
            <input
              type="checkbox"
              checked={globalOnly}
              onChange={(event) => setGlobalOnly(event.target.checked)}
            />
            Apenas Stacks Globais
          </label>
          <button type="button" className="header-button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </>
      }
    >
      <div className="dashboard">
        {error && <div className="inline-alert">{error}</div>}
        <section className="section">
          <h2>Stacks</h2>
          <div className="table-tools stacks-filters">
            <label className="form-field">
              Stack
              <select value={stackFilter} onChange={(event) => setStackFilter(event.target.value)}>
                <option value="">Todas as stacks</option>
                {stackOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Instância
              <select value={instanceFilter} onChange={(event) => setInstanceFilter(event.target.value)}>
                <option value="">Todas as instâncias</option>
                {instanceOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={attentionOnly}
                onChange={(event) => setAttentionOnly(event.target.checked)}
              />
              Atenção
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={instanceDriftOnly}
                onChange={(event) => setInstanceDriftOnly(event.target.checked)}
              />
              Drift entre instâncias
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={digestOnlyFilter}
                onChange={(event) => setDigestOnlyFilter(event.target.checked)}
              />
              Drift de digest
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(event) => setShowRemoved(event.target.checked)}
              />
              Mostrar removidas
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}>Carregando...</td>
                </tr>
              ) : pagedStacks.length === 0 ? (
                <tr>
                  <td colSpan={3}>Nenhuma stack encontrada.</td>
                </tr>
              ) : (
                pagedStacks.map((stack) => (
                  <tr key={stack.id}>
                    <td>
                      <div className="stack-name-cell">
                        <span
                          className={`status-dot ${
                            stack.isAccessible ? (stack.status === 'ok' ? 'ok' : 'warn') : 'down'
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          {stack.name} / {stack.instanceLabel}
                          {stack.removedAt ? ' (removida)' : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      {stack.status === 'ok' ? (
                        <span className="badge ok">OK</span>
                      ) : (
                        <div className="status-badges">
                          <span className="badge warn">Atenção</span>
                          {stack.outdated && <span className="badge problem">Stack desatualizada</span>}
                          {stack.instanceDrifted && <span className="badge problem">Drift instâncias</span>}
                          {stack.digestDrifted && <span className="badge problem">Digest</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {globalStackNames.has(stack.name.toLowerCase()) && stack.instanceId && !stack.removedAt ? (
                        <button type="button" onClick={() => handleOpenRedeploy(stack)}>
                          Redeploy
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setSelected(stack)}>
                        Detalhes
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setRemoveTarget(stack);
                          setRemoveConfirm('');
                        }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="table-pagination">
            <div className="page-info">
              Página {stacksPage} de {stacksTotalPages}
            </div>
            <div className="page-controls">
              <button
                type="button"
                onClick={() => setStacksPage((prev) => Math.max(1, prev - 1))}
                disabled={stacksPage <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setStacksPage((prev) => Math.min(stacksTotalPages, prev + 1))}
                disabled={stacksPage >= stacksTotalPages}
              >
                Próxima
              </button>
              <select
                value={stacksPageSize}
                onChange={(event) => {
                  setStacksPageSize(Number(event.target.value));
                  setStacksPage(1);
                }}
                aria-label="Itens por página"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}/página
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
      <StackRedeployModal
        isOpen={redeployOpen}
        stack={redeployTarget}
        localStacks={localStacks}
        onClose={() => {
          setRedeployOpen(false);
          setRedeployTarget(null);
        }}
        onSuccess={() => {
          setToastMessage('Redeploy enfileirado.');
          void loadData();
        }}
      />
      {selected && (
        <Modal
          isOpen={Boolean(selected)}
          title="Detalhes da stack"
          className="stack-detail-modal"
          onClose={() => setSelected(null)}
        >
          <div className="stack-summary">
            <div>
              <div className="stack-summary-title">Stack selecionada</div>
              <div className="stack-summary-subtitle">{selected.instanceLabel}</div>
            </div>
            <div className="stack-summary-badges">
              <span className={`badge ${selected.status === 'ok' ? 'ok' : 'warn'}`}>
                {selected.status === 'ok' ? 'OK' : 'Atenção'}
              </span>
            </div>
          </div>
          {globalStackNames.has(selected.name.toLowerCase()) && selected.instanceId && !selected.removedAt ? (
            <div className="stack-redeploy">
              <button
                type="button"
                onClick={() => {
                  const target = stacks.find((stack) => stack.id === selected.id) ?? null;
                  setRedeployTarget(target);
                  setRedeployOpen(true);
                }}
              >
                Redeploy stack
              </button>
            </div>
          ) : null}
          <div className="stack-metadata">
            <div>
              <strong>Stack</strong>
              <span>{selected.name}</span>
            </div>
            <div>
              <strong>Drift entre instâncias</strong>
              <span>{selected.instanceDrifted ? 'Sim' : 'Não'}</span>
            </div>
            <div>
              <strong>Drift de digest</strong>
              <span>{selected.digestDrifted ? 'Sim' : 'Não'}</span>
            </div>
          </div>
        </Modal>
      )}
      {removeTarget && (
        <Modal
          isOpen={Boolean(removeTarget)}
          title="Remover stack"
          className="danger-modal"
          onClose={() => setRemoveTarget(null)}
        >
          <p>
            Você está prestes a remover a stack <strong>{removeTarget.name}</strong> na instância{' '}
            <strong>{removeTarget.instanceLabel}</strong>.
          </p>
          <p>Para confirmar, digite <strong>remover</strong>.</p>
          <input
            value={removeConfirm}
            onChange={(event) => setRemoveConfirm(event.target.value)}
            placeholder="Digite remover"
            disabled={removeLoading}
          />
          <div className="modal-actions">
            <button
              type="button"
              className="danger"
              disabled={!canConfirmRemove || removeLoading}
              onClick={handleRemove}
            >
              {removeLoading ? 'Removendo...' : 'Confirmar remoção'}
            </button>
            <button type="button" className="secondary" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
      {toastMessage && (
        <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </AppLayout>
  );
}
