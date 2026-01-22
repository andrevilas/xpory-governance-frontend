import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchAuditResults, fetchAuditRuns, runAudit, AuditResult, JobRun as AuditRun } from '../../services/audit';
import {
  fetchInventoryStacks,
  fetchInventorySummary,
  runInventory,
  removeInventoryStack,
  InventoryStack,
  InventorySummary,
} from '../../services/inventory';
import { fetchStacksLocal } from '../../services/stacksLocal';
import {
  fetchRegistryRuns,
  fetchStackRegistryImages,
  runRegistry,
  updateRegistryStack,
  RegistryImageState,
  RegistryRun,
  RegistryUpdateResult,
} from '../../services/registry';
import './dashboard.css';
import '../../components/ui/modal.css';

type StackRow = {
  id: string;
  name: string;
  status: 'ok' | 'warn';
  version: string;
  instanceLabel: string;
  instanceName: string | null;
  instanceDrifted: boolean;
  digestDrifted: boolean;
  removedAt: string | null;
  isAccessible: boolean;
};

export function DashboardPage(): JSX.Element {
  const [stackFilter, setStackFilter] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);
  const [stacksPage, setStacksPage] = useState(1);
  const [stacksPageSize, setStacksPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  const [digestOnlyFilter, setDigestOnlyFilter] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [globalOnly, setGlobalOnly] = useState(false);
  const [registryImages, setRegistryImages] = useState<RegistryImageState[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryRunLoading, setRegistryRunLoading] = useState(false);
  const [registryUpdateDryRun, setRegistryUpdateDryRun] = useState(true);
  const [registryUpdateLoading, setRegistryUpdateLoading] = useState(false);
  const [registryUpdateResult, setRegistryUpdateResult] = useState<RegistryUpdateResult | null>(null);
  const [registryRuns, setRegistryRuns] = useState<RegistryRun[]>([]);
  const [removeTarget, setRemoveTarget] = useState<StackRow | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState<{ title: string; message: string; meta: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auditFailedCount = useMemo(
    () => auditRuns.filter((run) => run.status === 'failed').length,
    [auditRuns],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stacksResult, summaryResult, auditRunsResult, stacksLocalResult] = await Promise.all([
        fetchInventoryStacks(showRemoved),
        fetchInventorySummary(),
        fetchAuditRuns(8),
        globalOnly ? fetchStacksLocal() : Promise.resolve([]),
      ]);
      if (globalOnly) {
        const globalNames = new Set(
          (stacksLocalResult ?? []).map((stack) => stack.name.toLowerCase()),
        );
        const filteredStacks = stacksResult.filter((stack) =>
          globalNames.has(stack.name.toLowerCase()),
        );
        setStacks(filteredStacks);
      } else {
        setStacks(stacksResult);
      }
      setSummary(summaryResult);
      setAuditRuns(auditRunsResult);
    } catch (err) {
      void err;
      setError('Não foi possível carregar dados do inventário.');
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
      version: stack.type ? String(stack.type) : 'N/A',
      instanceLabel: stack.instanceName ?? `Endpoint ${stack.endpointId}`,
      instanceName: stack.instanceName,
      instanceDrifted: stack.instanceDrifted,
      digestDrifted: stack.digestDrifted,
      removedAt: stack.removedAt,
      isAccessible: stack.status === 1 && !stack.removedAt,
    }));
  }, [stacks]);

  const stackOptions = useMemo(() => {
    const names = new Set<string>();
    stackRows.forEach((row) => names.add(row.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stackRows]);

  useEffect(() => {
    if (selected && !stackRows.some((row) => row.id === selected.id)) {
      setSelected(null);
    }
  }, [stackRows, selected]);

  const instanceOptions = useMemo(() => {
    const names = new Set<string>();
    stackRows.forEach((row) => {
      if (row.instanceName) {
        names.add(row.instanceName);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stackRows]);

  useEffect(() => {
    const loadAudit = async () => {
      if (!selected) {
        setAuditResults([]);
        return;
      }
      setAuditLoading(true);
      try {
        const results = await fetchAuditResults(selected.id);
        setAuditResults(results);
      } catch (err) {
        void err;
        setAuditResults([]);
      } finally {
        setAuditLoading(false);
      }
    };

    void loadAudit();
  }, [selected]);

  useEffect(() => {
    const loadRegistry = async () => {
      if (!selected) {
        setRegistryImages([]);
        setRegistryError(null);
        setRegistryUpdateResult(null);
        return;
      }
      setRegistryLoading(true);
      setRegistryError(null);
      try {
        const result = await fetchStackRegistryImages(selected.id);
        setRegistryImages(result);
      } catch (err) {
        void err;
        setRegistryError('Não foi possível carregar detalhes de digest.');
        setRegistryImages([]);
      } finally {
        setRegistryLoading(false);
      }
    };

    void loadRegistry();
  }, [selected]);

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const result = await fetchRegistryRuns(10);
        setRegistryRuns(result);
      } catch (err) {
        void err;
      }
    };
    void loadRuns();
  }, []);

  const filteredStacks = useMemo(
    () => {
      let filtered = stackRows;
      if (stackFilter) {
        filtered = filtered.filter((row) => row.name === stackFilter);
      }
      if (instanceFilter) {
        filtered = filtered.filter((row) => row.instanceName === instanceFilter);
      }
      return digestOnlyFilter ? filtered.filter((row) => row.digestDrifted) : filtered;
    },
    [stackFilter, stackRows, digestOnlyFilter, instanceFilter]
  );

  useEffect(() => {
    setStacksPage(1);
  }, [stackFilter, instanceFilter, digestOnlyFilter, showRemoved]);

  const stacksTotalPages = Math.max(1, Math.ceil(filteredStacks.length / stacksPageSize));
  const pagedStacks = useMemo(() => {
    const start = (stacksPage - 1) * stacksPageSize;
    return filteredStacks.slice(start, start + stacksPageSize);
  }, [filteredStacks, stacksPage, stacksPageSize]);

  const filteredAuditResults = useMemo(() => {
    if (!auditFilter) {
      return auditResults;
    }
    const needle = auditFilter.toLowerCase();
    return auditResults.filter((item) => item.image.toLowerCase().includes(needle));
  }, [auditFilter, auditResults]);

  const operationalRows = useMemo(() => {
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
        return {
          id: stack.id,
          instanceLabel: stack.instanceName ?? `Endpoint ${stack.endpointId}`,
          name: stack.name,
          status: problems.length > 0 ? 'Atenção' : 'OK',
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

  useEffect(() => {
    setHistoryPage(1);
  }, [operationalRows.length]);

  const historyTotalPages = Math.max(1, Math.ceil(operationalRows.length / historyPageSize));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return operationalRows.slice(start, start + historyPageSize);
  }, [operationalRows, historyPage, historyPageSize]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await runInventory();
      await runAudit();
      await loadData();
    } catch (err) {
      void err;
      setError('Não foi possível atualizar agora. Tente novamente em instantes.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshHistory = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [auditRunsResult, summaryResult, stacksResult, stacksLocalResult] = await Promise.all([
        fetchAuditRuns(8),
        fetchInventorySummary(),
        fetchInventoryStacks(showRemoved),
        globalOnly ? fetchStacksLocal() : Promise.resolve([]),
      ]);
      setAuditRuns(auditRunsResult);
      setSummary(summaryResult);
      if (globalOnly) {
        const globalNames = new Set(
          (stacksLocalResult ?? []).map((stack) => stack.name.toLowerCase()),
        );
        const filteredStacks = stacksResult.filter((stack) =>
          globalNames.has(stack.name.toLowerCase()),
        );
        setStacks(filteredStacks);
      } else {
        setStacks(stacksResult);
      }
    } catch (err) {
      void err;
      setError('Não foi possível sincronizar o histórico.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRegistryRun = async () => {
    setRegistryRunLoading(true);
    setError(null);
    try {
      await runRegistry();
      const runs = await fetchRegistryRuns(10);
      setRegistryRuns(runs);
      await loadData();
      if (selected) {
        const result = await fetchStackRegistryImages(selected.id);
        setRegistryImages(result);
      }
      setToastMessage('Registry watcher atualizado');
    } catch (err) {
      void err;
      setError('Não foi possível atualizar o registry watcher.');
    } finally {
      setRegistryRunLoading(false);
    }
  };

  const handleRegistryUpdate = async () => {
    if (!selected) {
      return;
    }
    setRegistryUpdateLoading(true);
    setRegistryUpdateResult(null);
    setRegistryError(null);
    try {
      const result = await updateRegistryStack(selected.id, { dryRun: registryUpdateDryRun });
      setRegistryUpdateResult(result);
      const refreshed = await fetchStackRegistryImages(selected.id);
      setRegistryImages(refreshed);
    } catch (err) {
      void err;
      setRegistryError('Falha ao executar update por digest.');
    } finally {
      setRegistryUpdateLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }
    setRemoveLoading(true);
    try {
      await removeInventoryStack(removeTarget.id);
      setToastMessage('Stack removida com sucesso');
      setRemoveTarget(null);
      setRemoveConfirm('');
      await loadData();
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

  const formatStatus = (status: string) => (status === 'success' ? 'OK' : 'Não concluído');
  const statusClass = (status: string) => (status === 'success' ? 'ok' : 'warn');
  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return 'n/a';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'n/a';
    }
    return parsed.toLocaleString('pt-BR');
  };
  const lastRegistryRun = registryRuns[0] ?? null;

  const handleExportAudit = () => {
    if (filteredAuditResults.length === 0) {
      setToastMessage('Nenhum dado para exportar');
      return;
    }
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = filteredAuditResults.map((item) => [
      item.image,
      item.currentTag,
      item.latestTag,
      item.updateAvailable ? 'Atualização' : 'OK',
      item.riskLevel,
    ]);
    const csv = [
      ['Imagem', 'Tag atual', 'Última tag', 'Status', 'Risco'],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsv(String(value ?? ''))).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = selected?.name ? `audit-${selected.name}.csv` : 'audit.csv';
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout
      title="Dashboard"
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
          <button type="button" className="header-button" onClick={handleRefreshHistory} disabled={refreshing}>
            Sincronizar histórico
          </button>
          <button type="button" className="header-button" onClick={handleRegistryRun} disabled={registryRunLoading}>
            {registryRunLoading ? 'Atualizando registry...' : 'Atualizar registry watcher'}
          </button>
        </>
      }
    >
      <div className="dashboard">
        <section className="card-grid" data-testid="dashboard.summary.cards">
          <div className="card">
            <h3>Instâncias</h3>
            <div className="value">{loading ? '-' : summary?.instances ?? 0}</div>
          </div>
          <div className="card">
            <h3>Stacks monitoradas</h3>
            <div className="value" data-testid="dashboard.kpi.inventory.count">
              {loading ? '-' : summary?.stacks ?? 0}
            </div>
          </div>
          <div className="card">
            <h3>Auditorias com falha</h3>
            <div className="value" data-testid="dashboard.kpi.updates.count">
              {loading ? '-' : auditFailedCount}
            </div>
          </div>
          <div className="card">
            <h3>Atenção necessária</h3>
            <div className="value" data-testid="dashboard.kpi.alerts.count">
              {loading ? '-' : summary?.outdatedStacks ?? 0}
            </div>
          </div>
          <div className="card">
            <h3>Drift entre instâncias</h3>
            <div className="value">
              {loading ? '-' : summary?.instanceDriftedStacks ?? 0}
            </div>
          </div>
          <div className="card">
            <h3>Drift de digest</h3>
            <div className="value">
              {loading ? '-' : summary?.digestDriftedStacks ?? 0}
            </div>
          </div>
        </section>

        {error && <div className="inline-alert">{error}</div>}

        <section className="section">
          <h2>Stacks</h2>
          <div className="table-tools stacks-filters">
            <label className="form-field">
              Stack
              <select
                value={stackFilter}
                onChange={(event) => setStackFilter(event.target.value)}
                data-testid="inventory.filter.search.input"
              >
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
              <select
                value={instanceFilter}
                onChange={(event) => setInstanceFilter(event.target.value)}
              >
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
                checked={digestOnlyFilter}
                onChange={(event) => setDigestOnlyFilter(event.target.checked)}
              />
              Somente digest divergente
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
          <table className="table" data-testid="inventory.list.table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Digest</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pagedStacks.map((stack) => (
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
                    <span className={`badge ${stack.status}`}>
                      {stack.status === 'ok' ? 'OK' : 'Atenção'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${stack.digestDrifted ? 'warn' : 'ok'}`}>
                      {stack.digestDrifted ? 'Drift' : 'OK'}
                    </span>
                  </td>
                  <td>
                    <button type="button" onClick={() => setSelected(stack)}>
                      Detalhes
                    </button>
                    <button type="button" className="danger" onClick={() => {
                      setRemoveTarget(stack);
                      setRemoveConfirm('');
                    }}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
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

        <section className="section">
          <h2>Histórico operacional</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Instância</th>
                <th>Stack</th>
                <th>Status</th>
                <th>Quando</th>
                <th>Problema detectado</th>
              </tr>
            </thead>
            <tbody>
              {pagedHistory.map((row) => (
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
                </tr>
              ))}
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

        <section className="section">
          <h2>Auditoria</h2>
          <p>Última auditoria: {summary?.lastAuditAt ?? 'pendente'}</p>
          <p>Stacks desatualizadas: {summary?.outdatedStacks ?? 0}</p>
          <p>Stacks com drift entre instâncias: {summary?.instanceDriftedStacks ?? 0}</p>
          <p>Stacks com drift de digest: {summary?.digestDriftedStacks ?? 0}</p>
        </section>

        <section className="section">
          <h2>Guia rápido operacional</h2>
          <ol className="onboarding">
            <li>Revise o inventário e identifique stacks desatualizadas.</li>
            <li>Abra a tela de Atualizações e execute o dry-run.</li>
            <li>Aprove o update e acompanhe os health-checks.</li>
            <li>Monitore alertas e logs para validar o resultado.</li>
          </ol>
        </section>
      </div>

      {selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal stack-detail-modal">
            <header>
              <h3 data-testid="inventory.detail.hostname.text">{selected.name}</h3>
              <button type="button" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </header>
            <div className="stack-summary">
              <div>
                <div className="stack-summary-title">Stack selecionada</div>
                <div className="stack-summary-subtitle">{selected.instanceLabel}</div>
              </div>
              <div className="stack-summary-badges">
                <span className={`badge ${selected.status === 'ok' ? 'ok' : 'warn'}`}>
                  {selected.status === 'ok' ? 'OK' : 'Atenção'}
                </span>
                <span className="badge neutral">{selected.version}</span>
              </div>
            </div>

            <div className="stack-metadata">
              <div>
                <strong>Última auditoria</strong>
                <span>{summary?.lastAuditAt ?? 'pendente'}</span>
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

            <section className="audit-results">
              <h4>Auditoria da stack</h4>
              <div className="table-tools">
                <input
                  placeholder="Filtrar por imagem"
                  value={auditFilter}
                  onChange={(event) => setAuditFilter(event.target.value)}
                  data-testid="audit.filter.actor.input"
                />
                <button
                  type="button"
                  data-testid="audit.export.button"
                  onClick={handleExportAudit}
                  disabled={filteredAuditResults.length === 0}
                >
                  Exportar
                </button>
              </div>
              {auditLoading ? (
                <p>Carregando auditoria...</p>
              ) : filteredAuditResults.length === 0 ? (
                <p>Nenhum resultado disponível.</p>
              ) : (
                <table data-testid="audit.events.table">
                  <thead>
                    <tr>
                      <th>Imagem</th>
                      <th>Atual</th>
                      <th>Última</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditResults.map((item) => (
                      <tr key={item.id}>
                        <td>{item.image}</td>
                        <td>{item.currentTag}</td>
                        <td>{item.latestTag}</td>
                        <td>{item.updateAvailable ? 'Atualização' : 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="registry-results">
              <h4>Digest registry</h4>
              <p className="helper-text">
                Última execução do registry watcher:{' '}
                {lastRegistryRun
                  ? `${formatDateTime(lastRegistryRun.createdAt)} · ${lastRegistryRun.status}`
                  : 'n/a'}
              </p>
              <div className="table-tools">
                <label className="filter-toggle">
                  <input
                    type="checkbox"
                    checked={registryUpdateDryRun}
                    onChange={(event) => setRegistryUpdateDryRun(event.target.checked)}
                  />
                  Dry-run
                </label>
                <button type="button" onClick={handleRegistryUpdate} disabled={registryUpdateLoading}>
                  {registryUpdateLoading ? 'Executando...' : 'Atualizar por digest'}
                </button>
              </div>
              {registryError && <div className="inline-alert">{registryError}</div>}
              {registryUpdateResult && (
                <p className="helper-text">
                  Resultado: {registryUpdateResult.status}{' '}
                  {registryUpdateResult.rollbackApplied ? '(rollback aplicado)' : ''}
                </p>
              )}
              {registryUpdateResult?.refreshLog && registryUpdateResult.refreshLog.length > 0 ? (
                <div className="registry-log">
                  <h5>Log do refresh de imagens</h5>
                  <table>
                    <thead>
                      <tr>
                        <th>Imagem</th>
                        <th>Remoção</th>
                        <th>Pull</th>
                        <th>Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registryUpdateResult.refreshLog.map((entry) => (
                        <tr key={`${entry.image}:${entry.tag}`}>
                          <td className="truncate">{entry.image}:{entry.tag}</td>
                          <td>{entry.removed ? 'OK' : 'Falhou'}</td>
                          <td>{entry.pulled ? 'OK' : 'Falhou'}</td>
                          <td className="mono">{entry.errors.length > 0 ? entry.errors.join(' | ') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {registryLoading ? (
                <p>Carregando digest...</p>
              ) : registryImages.length === 0 ? (
                <p>Nenhuma imagem registrada.</p>
              ) : (
                <div className="registry-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Imagem</th>
                        <th>Tag</th>
                        <th>Digest em uso (instância)</th>
                        <th>Digest no registry</th>
                        <th>Visto em</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registryImages.map((image) => (
                        <tr key={`${image.image}:${image.tag}`}>
                          <td className="truncate">{image.image}</td>
                          <td>{image.tag}</td>
                          <td className="mono">{image.digest ?? 'n/a'}</td>
                          <td className="mono">{image.registryDigest ?? 'n/a'}</td>
                          <td>{formatDateTime(image.lastSeenAt)}</td>
                          <td>
                            <span className={`badge ${image.drifted ? 'warn' : 'ok'}`}>
                              {image.drifted ? 'Drift' : 'OK'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal danger-modal">
            <header>
              <h3>Remover stack</h3>
              <button type="button" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>
                Fechar
              </button>
            </header>
            <p>
              Você está prestes a remover a stack <strong>{removeTarget.name}</strong> na instância{' '}
              <strong>{removeTarget.instanceLabel}</strong>.
            </p>
            <p>Para confirmar, digite <strong>remover</strong>.</p>
            <input
              value={removeConfirm}
              onChange={(event) => setRemoveConfirm(event.target.value)}
              placeholder="Digite remover"
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
          </div>
        </div>
      )}

      {errorDetail && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <header>
              <h3>{errorDetail.title}</h3>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(errorDetail.message);
                    setToastMessage('Mensagem copiada');
                  }}
                >
                  Copiar detalhe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${errorDetail.message}\n\n${errorDetail.meta}`);
                    setToastMessage('Detalhes copiados');
                  }}
                >
                  Copiar tudo
                </button>
                <button type="button" onClick={() => setErrorDetail(null)}>
                  Fechar
                </button>
              </div>
            </header>
            <pre className="error-detail">{errorDetail.message}</pre>
            <pre className="error-detail meta">{errorDetail.meta}</pre>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </AppLayout>
  );
}
