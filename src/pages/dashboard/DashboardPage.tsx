import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchAuditResults, fetchAuditRuns, runAudit, AuditResult, JobRun as AuditRun } from '../../services/audit';
import {
  fetchInventoryStacks,
  fetchInventorySummary,
  runInventory,
  InventoryStack,
  InventorySummary,
} from '../../services/inventory';
import {
  fetchStackRegistryImages,
  runRegistry,
  updateRegistryStack,
  RegistryImageState,
  RegistryUpdateResult,
} from '../../services/registry';
import './dashboard.css';
import '../../components/ui/modal.css';

type StackRow = {
  id: string;
  name: string;
  status: 'ok' | 'warn';
  version: string;
  endpointLabel: string;
  instanceName: string | null;
  instanceDrifted: boolean;
  digestDrifted: boolean;
  removedAt: string | null;
};

export function DashboardPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);
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
  const [registryImages, setRegistryImages] = useState<RegistryImageState[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryRunLoading, setRegistryRunLoading] = useState(false);
  const [registryUpdateDryRun, setRegistryUpdateDryRun] = useState(true);
  const [registryUpdateLoading, setRegistryUpdateLoading] = useState(false);
  const [registryUpdateResult, setRegistryUpdateResult] = useState<RegistryUpdateResult | null>(null);
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
      const [stacksResult, summaryResult, auditRunsResult] = await Promise.all([
        fetchInventoryStacks(showRemoved),
        fetchInventorySummary(),
        fetchAuditRuns(8),
      ]);
      setStacks(stacksResult);
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
  }, [showRemoved]);

  const stackRows = useMemo<StackRow[]>(() => {
    return stacks.map((stack) => ({
      id: stack.id,
      name: stack.name,
      status: stack.outdated || stack.instanceDrifted || stack.digestDrifted ? 'warn' : 'ok',
      version: stack.type ? String(stack.type) : 'N/A',
      endpointLabel: stack.instanceName
        ? `${stack.instanceName} / endpoint ${stack.endpointId}`
        : `Endpoint ${stack.endpointId}`,
      instanceName: stack.instanceName,
      instanceDrifted: stack.instanceDrifted,
      digestDrifted: stack.digestDrifted,
      removedAt: stack.removedAt,
    }));
  }, [stacks]);

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

  const filteredStacks = useMemo(
    () => {
      let filtered = stackRows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
      if (instanceFilter) {
        filtered = filtered.filter((row) => row.instanceName === instanceFilter);
      }
      return digestOnlyFilter ? filtered.filter((row) => row.digestDrifted) : filtered;
    },
    [search, stackRows, digestOnlyFilter, instanceFilter]
  );

  const filteredAuditResults = useMemo(() => {
    if (!auditFilter) {
      return auditResults;
    }
    const needle = auditFilter.toLowerCase();
    return auditResults.filter((item) => item.image.toLowerCase().includes(needle));
  }, [auditFilter, auditResults]);

  const operationalRows = useMemo(() => {
    return stacks.map((stack) => {
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
      return {
        id: stack.id,
        instanceLabel: stack.instanceName ?? `Endpoint ${stack.endpointId}`,
        name: stack.name,
        status: problems.length > 0 ? 'Atenção' : 'OK',
        when: stack.lastSnapshotAt ? new Date(stack.lastSnapshotAt).toLocaleString('pt-BR') : 'n/a',
        problem: problems.length > 0 ? problems.join(' | ') : 'OK',
      };
    });
  }, [stacks]);

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
      const [auditRunsResult, summaryResult, stacksResult] = await Promise.all([
        fetchAuditRuns(8),
        fetchInventorySummary(),
        fetchInventoryStacks(showRemoved),
      ]);
      setAuditRuns(auditRunsResult);
      setSummary(summaryResult);
      setStacks(stacksResult);
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

  const formatStatus = (status: string) => (status === 'success' ? 'OK' : 'Não concluído');
  const statusClass = (status: string) => (status === 'success' ? 'ok' : 'warn');

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
          <div className="table-tools">
            <input
              placeholder="Filtrar por nome"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              data-testid="inventory.filter.search.input"
            />
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
                <th>Endpoint</th>
                <th>Status</th>
                <th>Digest</th>
                <th>Tipo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredStacks.map((stack) => (
                <tr key={stack.id}>
                  <td>
                    {stack.name}
                    {stack.removedAt ? ' (removida)' : ''}
                  </td>
                  <td>{stack.endpointLabel}</td>
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
                  <td>{stack.version}</td>
                  <td>
                    <button type="button" onClick={() => setSelected(stack)}>
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {operationalRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.instanceLabel}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`badge ${row.status === 'OK' ? 'ok' : 'warn'}`}>{row.status}</span>
                  </td>
                  <td>{row.when}</td>
                  <td>{row.problem}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <div className="stack-summary-subtitle">{selected.endpointLabel}</div>
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
                        <th>Digest local</th>
                        <th>Digest registry</th>
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
