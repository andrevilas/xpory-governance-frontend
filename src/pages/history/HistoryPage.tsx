import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { StackRedeployModal } from '../../components/stacks/StackRedeployModal';
import { useActionNotifications } from '../../context/actions/useActionNotifications';
import { createRemoveAction, createRemoveLocalAction } from '../../services/actions';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { fetchStackDeployHistory, fetchStacksLocal, StackDeployHistory, StackLocal } from '../../services/stacksLocal';
import '../dashboard/dashboard.css';

type HistoryRow = {
  id: string;
  instanceId: string | null;
  instanceLabel: string;
  instanceName: string | null;
  name: string;
  status: 'OK' | 'Atenção';
  whenDate: Date | null;
  when: string;
  problems: string[];
};

export function HistoryPage(): JSX.Element {
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [localStacks, setLocalStacks] = useState<StackLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stackFilter, setStackFilter] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [outdatedOnly, setOutdatedOnly] = useState(false);
  const [instanceDriftOnly, setInstanceDriftOnly] = useState(false);
  const [digestDriftOnly, setDigestDriftOnly] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [redeployTarget, setRedeployTarget] = useState<InventoryStack | null>(null);
  const [redeployOpen, setRedeployOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsEntries, setDetailsEntries] = useState<StackDeployHistory[]>([]);
  const [detailsTarget, setDetailsTarget] = useState<HistoryRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<HistoryRow | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeLocalTarget, setRemoveLocalTarget] = useState<HistoryRow | null>(null);
  const [removeLocalConfirm, setRemoveLocalConfirm] = useState('');
  const [removeLocalLoading, setRemoveLocalLoading] = useState(false);
  const { trackAction, subscribeAction } = useActionNotifications();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, stacksLocal] = await Promise.all([fetchInventoryStacks(), fetchStacksLocal()]);
      setStacks(result);
      setLocalStacks(stacksLocal ?? []);
    } catch (err) {
      void err;
      setError('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const operationalRows = useMemo<HistoryRow[]>(() => {
    return stacks
      .map((stack) => {
        const problems: string[] = [];
        if (stack.outdated) {
          problems.push('Stack desatualizada');
        }
        if (stack.instanceDrifted) {
          problems.push('Drift entre instâncias');
        }
        if (stack.digestDrifted) {
          problems.push('Drift de digest');
        }
        const whenDate = stack.lastSnapshotAt ? new Date(stack.lastSnapshotAt) : null;
        const status: HistoryRow['status'] = problems.length > 0 ? 'Atenção' : 'OK';
        return {
          id: stack.id,
          instanceId: stack.instanceId,
          instanceLabel: stack.instanceName ?? `Endpoint ${stack.endpointId}`,
          instanceName: stack.instanceName,
          name: stack.name,
          status,
          whenDate,
          when: whenDate ? whenDate.toLocaleString('pt-BR') : 'n/a',
          problems,
        };
      })
      .sort((a, b) => {
        const aTime = a.whenDate ? a.whenDate.getTime() : 0;
        const bTime = b.whenDate ? b.whenDate.getTime() : 0;
        return bTime - aTime;
      });
  }, [stacks]);

  const stackOptions = useMemo(() => {
    const names = new Set<string>();
    operationalRows.forEach((row) => names.add(row.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [operationalRows]);

  const instanceOptions = useMemo(() => {
    const names = new Set<string>();
    operationalRows.forEach((row) => {
      if (row.instanceName) {
        names.add(row.instanceName);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [operationalRows]);

  const filteredRows = useMemo(() => {
    let filtered = operationalRows;
    if (stackFilter) {
      filtered = filtered.filter((row) => row.name === stackFilter);
    }
    if (instanceFilter) {
      filtered = filtered.filter((row) => row.instanceName === instanceFilter);
    }
    if (attentionOnly) {
      filtered = filtered.filter((row) => row.status === 'Atenção');
    }
    if (outdatedOnly) {
      filtered = filtered.filter((row) => row.problems.includes('Stack desatualizada'));
    }
    if (instanceDriftOnly) {
      filtered = filtered.filter((row) => row.problems.includes('Drift entre instâncias'));
    }
    if (digestDriftOnly) {
      filtered = filtered.filter((row) => row.problems.includes('Drift de digest'));
    }
    return filtered;
  }, [operationalRows, stackFilter, instanceFilter, attentionOnly, outdatedOnly, instanceDriftOnly, digestDriftOnly]);

  useEffect(() => {
    setHistoryPage(1);
  }, [stackFilter, instanceFilter, attentionOnly, outdatedOnly, instanceDriftOnly, digestDriftOnly]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredRows.length / historyPageSize));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredRows.slice(start, start + historyPageSize);
  }, [filteredRows, historyPage, historyPageSize]);

  const globalStackNames = useMemo(
    () => new Set(localStacks.map((stack) => stack.name.toLowerCase())),
    [localStacks],
  );
  const localStackIdByName = useMemo(() => {
    const map = new Map<string, string>();
    localStacks.forEach((stack) => map.set(stack.name.toLowerCase(), stack.id));
    return map;
  }, [localStacks]);

  const handleOpenRedeploy = (row: HistoryRow) => {
    const target = stacks.find((stack) => stack.id === row.id) ?? null;
    setRedeployTarget(target);
    setRedeployOpen(true);
  };

  const handleOpenDetails = async (row: HistoryRow) => {
    if (!row.instanceId) {
      setDetailsError('Instância não encontrada para este registro.');
      setDetailsOpen(true);
      return;
    }
    const stackId = localStackIdByName.get(row.name.toLowerCase());
    if (!stackId) {
      setDetailsError('Stack global não encontrada para este registro.');
      setDetailsOpen(true);
      return;
    }
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailsTarget(row);
    try {
      const data = await fetchStackDeployHistory(stackId, row.instanceId, 5);
      setDetailsEntries(data);
    } catch (err) {
      void err;
      setDetailsError('Não foi possível carregar os detalhes de deploy.');
      setDetailsEntries([]);
    } finally {
      setDetailsLoading(false);
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
  const canConfirmRemoveLocal = removeLocalConfirm.trim().toLowerCase() === 'remover local';

  const handleRemoveLocal = async () => {
    if (!removeLocalTarget) {
      return;
    }
    setRemoveLocalLoading(true);
    try {
      const response = await createRemoveLocalAction({
        stackId: removeLocalTarget.id,
        instanceId: removeLocalTarget.instanceId,
      });
      trackAction({
        id: response.actionId,
        type: 'remove_stack_local',
        status: response.status,
        stackId: removeLocalTarget.id,
        instanceId: removeLocalTarget.instanceId,
        userId: null,
        message: 'Remoção local enfileirada',
        result: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stackName: removeLocalTarget.name,
        instanceLabel: removeLocalTarget.instanceLabel,
      });
      subscribeAction(response.actionId);
      setToastMessage('Remoção local enfileirada');
      setRemoveLocalTarget(null);
      setRemoveLocalConfirm('');
      void loadData();
    } catch (err) {
      const apiMessage =
        typeof err === 'object' && err !== null
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const message = apiMessage || (err instanceof Error ? err.message : 'Falha ao remover stack localmente');
      setToastMessage(message);
    } finally {
      setRemoveLocalLoading(false);
    }
  };

  return (
    <AppLayout title="Histórico operacional">
      <div className="dashboard">
        {error && <div className="inline-alert">{error}</div>}
        <section className="section">
          <h2>Histórico operacional</h2>
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
                checked={outdatedOnly}
                onChange={(event) => setOutdatedOnly(event.target.checked)}
              />
              Stack desatualizada
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
                checked={digestDriftOnly}
                onChange={(event) => setDigestDriftOnly(event.target.checked)}
              />
              Drift de digest
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Instância</th>
                <th>Stack</th>
                <th>Status</th>
                <th>Quando</th>
                <th>Problema detectado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Carregando...</td>
                </tr>
              ) : pagedHistory.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum registro encontrado.</td>
                </tr>
              ) : (
                pagedHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.instanceLabel}</td>
                    <td>{row.name}</td>
                    <td>
                      <span className={`badge ${row.status === 'OK' ? 'ok' : 'warn'}`}>{row.status}</span>
                    </td>
                    <td>{row.when}</td>
                    <td>
                      <div className="problem-badges">
                        {row.problems.length > 0 ? (
                          row.problems.map((problem) => (
                            <span key={problem} className="badge problem">
                              {problem}
                            </span>
                          ))
                        ) : (
                          <span className="badge problem-ok">OK</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="stack-redeploy">
                        {globalStackNames.has(row.name.toLowerCase()) && row.instanceId ? (
                          <button type="button" onClick={() => handleOpenRedeploy(row)}>
                            Redeploy
                          </button>
                        ) : null}
                        <button type="button" onClick={() => handleOpenDetails(row)}>
                          Detalhes
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setRemoveTarget(row);
                            setRemoveConfirm('');
                          }}
                        >
                          Remover
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setRemoveLocalTarget(row);
                            setRemoveLocalConfirm('');
                          }}
                        >
                          Remover local
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="table-pagination">
            <div className="page-info">
              Página {historyPage} de {historyTotalPages}
            </div>
            <div className="page-controls">
              <button
                type="button"
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={historyPage <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
                disabled={historyPage >= historyTotalPages}
              >
                Próxima
              </button>
              <select
                value={historyPageSize}
                onChange={(event) => {
                  setHistoryPageSize(Number(event.target.value));
                  setHistoryPage(1);
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
      {removeLocalTarget && (
        <Modal
          isOpen={Boolean(removeLocalTarget)}
          title="Remover stack localmente"
          className="danger-modal"
          onClose={() => setRemoveLocalTarget(null)}
        >
          <p>
            Você está prestes a remover localmente a stack <strong>{removeLocalTarget.name}</strong> na instância{' '}
            <strong>{removeLocalTarget.instanceLabel}</strong>.
          </p>
          <p>Esta ação remove apenas do inventário local e não remove no Portainer remoto.</p>
          <p>Para confirmar, digite <strong>remover local</strong>.</p>
          <input
            value={removeLocalConfirm}
            onChange={(event) => setRemoveLocalConfirm(event.target.value)}
            placeholder="Digite remover local"
            disabled={removeLocalLoading}
          />
          <div className="modal-actions">
            <button
              type="button"
              className="danger"
              disabled={!canConfirmRemoveLocal || removeLocalLoading}
              onClick={handleRemoveLocal}
            >
              {removeLocalLoading ? 'Removendo...' : 'Confirmar remoção local'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setRemoveLocalTarget(null)}
              disabled={removeLocalLoading}
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
      <Modal
        isOpen={detailsOpen}
        title="Detalhes do redeploy"
        onClose={() => {
          setDetailsOpen(false);
          setDetailsEntries([]);
          setDetailsTarget(null);
          setDetailsError(null);
        }}
      >
        {detailsError && <div className="inline-alert">{detailsError}</div>}
        {detailsLoading ? (
          <div className="empty-state">Carregando...</div>
        ) : detailsEntries.length === 0 ? (
          <div className="empty-state">Nenhum log de redeploy encontrado.</div>
        ) : (
          detailsEntries.map((entry) => (
            <div key={entry.id} className="redeploy-logs">
              <div className="redeploy-summary">
                <strong>{detailsTarget?.name ?? 'Stack'}</strong>
                <span>{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                <span>Status: {entry.result}</span>
                {entry.message ? <span>{entry.message}</span> : null}
              </div>
              {entry.refreshLog && entry.refreshLog.length > 0 && (
                <>
                  <h4>Refresh de imagens</h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Imagem</th>
                        <th>Tag</th>
                        <th>Removida</th>
                        <th>Puxada</th>
                        <th>Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.refreshLog.map((item) => (
                        <tr key={`${entry.id}-${item.image}:${item.tag}`}>
                          <td>{item.image}</td>
                          <td>{item.tag}</td>
                          <td>{item.removed ? 'Sim' : 'Nao'}</td>
                          <td>{item.pulled ? 'Sim' : 'Nao'}</td>
                          <td>{item.errors.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {entry.digestLog && entry.digestLog.length > 0 && (
                <>
                  <h4>Validacao de digest</h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Imagem</th>
                        <th>Tag</th>
                        <th>Local</th>
                        <th>Registry</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.digestLog.map((item) => (
                        <tr key={`${entry.id}-${item.image}:${item.tag}`}>
                          <td>{item.image}</td>
                          <td>{item.tag}</td>
                          <td className="mono">{item.localDigest ?? ''}</td>
                          <td className="mono">{item.registryDigest ?? ''}</td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          ))
        )}
      </Modal>
      {toastMessage && (
        <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </AppLayout>
  );
}
