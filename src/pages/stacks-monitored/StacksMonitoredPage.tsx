import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { fetchStacksLocal, StackLocal } from '../../services/stacksLocal';
import '../dashboard/dashboard.css';

type StackRow = {
  id: string;
  name: string;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [digestOnlyFilter, setDigestOnlyFilter] = useState(searchParams.get('digestDrift') === 'true');
  const [instanceDriftOnly, setInstanceDriftOnly] = useState(
    searchParams.get('instanceDrift') === 'true',
  );
  const [attentionOnly, setAttentionOnly] = useState(searchParams.get('attention') === 'true');
  const [globalOnly, setGlobalOnly] = useState(searchParams.get('globalOnly') !== 'false');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stacksResult, stacksLocalResult] = await Promise.all([
        fetchInventoryStacks(showRemoved),
        fetchStacksLocal(),
      ]);
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2}>Carregando...</td>
                </tr>
              ) : pagedStacks.length === 0 ? (
                <tr>
                  <td colSpan={2}>Nenhuma stack encontrada.</td>
                </tr>
              ) : (
                pagedStacks.map((stack) => (
                  <tr key={stack.id}>
                    <td>
                      <div className="stack-name-cell">
                        <span
                          className={`status-dot ${
                            stack.isAccessible ? (stack.digestDrifted ? 'warn' : 'ok') : 'down'
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
    </AppLayout>
  );
}
