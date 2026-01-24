import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { StackRedeployModal } from '../../components/stacks/StackRedeployModal';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { fetchStacksLocal, StackLocal } from '../../services/stacksLocal';
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

  const handleOpenRedeploy = (row: HistoryRow) => {
    const target = stacks.find((stack) => stack.id === row.id) ?? null;
    setRedeployTarget(target);
    setRedeployOpen(true);
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
                      {globalStackNames.has(row.name.toLowerCase()) && row.instanceId ? (
                        <button type="button" onClick={() => handleOpenRedeploy(row)}>
                          Redeploy
                        </button>
                      ) : null}
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
          setToastMessage('Redeploy realizado com sucesso.');
          void loadData();
        }}
      />
      {toastMessage && (
        <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </AppLayout>
  );
}
