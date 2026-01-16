import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchAuditResults, fetchAuditRuns, runAudit, AuditResult, JobRun as AuditRun } from '../../services/audit';
import {
  fetchInventoryStacks,
  fetchInventorySummary,
  fetchInventoryRuns,
  runInventory,
  InventoryStack,
  InventorySummary,
  JobRun as InventoryRun,
} from '../../services/inventory';
import {
  fetchStackRegistryImages,
  runRegistry,
  updateRegistryStack,
  RegistryImageState,
  RegistryUpdateResult,
} from '../../services/registry';
import './dashboard.css';

type StackRow = {
  id: string;
  name: string;
  status: 'ok' | 'warn';
  version: string;
  endpointLabel: string;
  instanceDrifted: boolean;
  digestDrifted: boolean;
};

export function DashboardPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inventoryRuns, setInventoryRuns] = useState<InventoryRun[]>([]);
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('');
  const [inventoryPeriodDays, setInventoryPeriodDays] = useState(7);
  const [auditPeriodDays, setAuditPeriodDays] = useState(7);
  const [inventoryRunsLimit, setInventoryRunsLimit] = useState(8);
  const [auditRunsLimit, setAuditRunsLimit] = useState(8);
  const [digestOnlyFilter, setDigestOnlyFilter] = useState(false);
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stacksResult, summaryResult, inventoryRunsResult, auditRunsResult] = await Promise.all([
        fetchInventoryStacks(),
        fetchInventorySummary(),
        fetchInventoryRuns(inventoryRunsLimit),
        fetchAuditRuns(auditRunsLimit),
      ]);
      setStacks(stacksResult);
      setSummary(summaryResult);
      setInventoryRuns(inventoryRunsResult);
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
  }, [inventoryRunsLimit, auditRunsLimit]);

  const stackRows = useMemo<StackRow[]>(() => {
    return stacks.map((stack) => ({
      id: stack.id,
      name: stack.name,
      status: stack.outdated || stack.instanceDrifted || stack.digestDrifted ? 'warn' : 'ok',
      version: stack.type ? String(stack.type) : 'N/A',
      endpointLabel: stack.instanceName
        ? `${stack.instanceName} / endpoint ${stack.endpointId}`
        : `Endpoint ${stack.endpointId}`,
      instanceDrifted: stack.instanceDrifted,
      digestDrifted: stack.digestDrifted,
    }));
  }, [stacks]);

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
      const filtered = stackRows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
      return digestOnlyFilter ? filtered.filter((row) => row.digestDrifted) : filtered;
    },
    [search, stackRows, digestOnlyFilter]
  );

  const filteredAuditResults = useMemo(() => {
    if (!auditFilter) {
      return auditResults;
    }
    const needle = auditFilter.toLowerCase();
    return auditResults.filter((item) => item.image.toLowerCase().includes(needle));
  }, [auditFilter, auditResults]);

  const filteredInventoryRuns = useMemo(() => {
    const cutoff = Date.now() - inventoryPeriodDays * 24 * 60 * 60 * 1000;
    return inventoryRuns.filter((run) => {
      const matchesStatus = !inventoryStatusFilter || run.status === inventoryStatusFilter;
      const matchesPeriod = new Date(run.createdAt).getTime() >= cutoff;
      return matchesStatus && matchesPeriod;
    });
  }, [inventoryRuns, inventoryStatusFilter, inventoryPeriodDays]);

  const filteredAuditRuns = useMemo(() => {
    const cutoff = Date.now() - auditPeriodDays * 24 * 60 * 60 * 1000;
    return auditRuns.filter((run) => {
      const matchesStatus = !auditStatusFilter || run.status === auditStatusFilter;
      const matchesPeriod = new Date(run.createdAt).getTime() >= cutoff;
      return matchesStatus && matchesPeriod;
    });
  }, [auditRuns, auditStatusFilter, auditPeriodDays]);

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
      const [inventoryRunsResult, auditRunsResult, summaryResult, stacksResult] = await Promise.all([
        fetchInventoryRuns(inventoryRunsLimit),
        fetchAuditRuns(auditRunsLimit),
        fetchInventorySummary(),
        fetchInventoryStacks(),
      ]);
      setInventoryRuns(inventoryRunsResult);
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

  return (
    <AppLayout title="Dashboard">
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
            <h3>Auditorias em andamento</h3>
            <div className="value" data-testid="dashboard.kpi.updates.count">0</div>
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

        <section className="section">
          <h2>Operação</h2>
          <div className="table-tools">
            <button type="button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? 'Atualizando...' : 'Atualizar dados'}
            </button>
            <button type="button" className="secondary" onClick={handleRefreshHistory} disabled={refreshing}>
              Sincronizar histórico
            </button>
            <button type="button" className="secondary" onClick={handleRegistryRun} disabled={registryRunLoading}>
              {registryRunLoading ? 'Atualizando registry...' : 'Atualizar registry watcher'}
            </button>
          </div>
        </section>

        <section className="section">
          <h2>Histórico de execuções</h2>
          <div className="history-grid">
            <div className="history-card">
              <h3>Inventário</h3>
              <div className="history-filters">
                <select
                  value={inventoryStatusFilter}
                  onChange={(event) => setInventoryStatusFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="success">Sucesso</option>
                  <option value="failed">Não concluído</option>
                </select>
                <select
                  value={inventoryPeriodDays}
                  onChange={(event) => setInventoryPeriodDays(Number(event.target.value))}
                >
                  <option value={1}>24h</option>
                  <option value={3}>3 dias</option>
                  <option value={7}>7 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>
              {inventoryRuns.length === 0 ? (
                <p>Nenhuma execução registrada.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Stacks</th>
                        <th>Horário</th>
                      <th>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventoryRuns.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() =>
                          run.error
                            ? setErrorDetail({
                                title: 'Detalhes do alerta',
                                message: run.error,
                                meta: `Status: ${run.status}\nStacks: ${run.stacksCount}\nHorário: ${new Date(run.createdAt).toISOString()}`,
                              })
                            : null
                        }
                        className={run.error ? 'clickable' : ''}
                      >
                        <td>
                          <span className={`pill ${statusClass(run.status)}`}>{formatStatus(run.status)}</span>
                        </td>
                        <td>{run.stacksCount}</td>
                        <td>{new Date(run.createdAt).toLocaleString()}</td>
                        <td className="error-cell">{run.error ? 'Detalhes disponíveis' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="history-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setInventoryRunsLimit((prev) => prev + 10)}
                >
                  Ver mais
                </button>
              </div>
            </div>
            <div className="history-card">
              <h3>Auditoria</h3>
              <div className="history-filters">
                <select
                  value={auditStatusFilter}
                  onChange={(event) => setAuditStatusFilter(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="success">Sucesso</option>
                  <option value="failed">Não concluído</option>
                </select>
                <select
                  value={auditPeriodDays}
                  onChange={(event) => setAuditPeriodDays(Number(event.target.value))}
                >
                  <option value={1}>24h</option>
                  <option value={3}>3 dias</option>
                  <option value={7}>7 dias</option>
                  <option value={30}>30 dias</option>
                </select>
              </div>
              {auditRuns.length === 0 ? (
                <p>Nenhuma execução registrada.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Stacks</th>
                        <th>Horário</th>
                      <th>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditRuns.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() =>
                          run.error
                            ? setErrorDetail({
                                title: 'Detalhes do alerta',
                                message: run.error,
                                meta: `Status: ${run.status}\nStacks: ${run.stacksCount}\nHorário: ${new Date(run.createdAt).toISOString()}`,
                              })
                            : null
                        }
                        className={run.error ? 'clickable' : ''}
                      >
                        <td>
                          <span className={`pill ${statusClass(run.status)}`}>{formatStatus(run.status)}</span>
                        </td>
                        <td>{run.stacksCount}</td>
                        <td>{new Date(run.createdAt).toLocaleString()}</td>
                        <td className="error-cell">{run.error ? 'Detalhes disponíveis' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="history-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setAuditRunsLimit((prev) => prev + 10)}
                >
                  Ver mais
                </button>
              </div>
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
              data-testid="inventory.filter.status.select"
            />
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={digestOnlyFilter}
                onChange={(event) => setDigestOnlyFilter(event.target.checked)}
              />
              Somente digest divergente
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
                  <td>{stack.name}</td>
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
          <div className="modal">
            <header>
              <h3 data-testid="inventory.detail.hostname.text">{selected.name}</h3>
              <button type="button" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </header>
            <p>Endpoint: {selected.endpointLabel}</p>
            <p>Status atual: {selected.status === 'ok' ? 'OK' : 'Atenção'}</p>
            <p>Tipo da stack: {selected.version}</p>
            <p>Última auditoria: {summary?.lastAuditAt ?? 'pendente'}</p>
            <p>Drift entre instâncias: {selected.instanceDrifted ? 'Sim' : 'Não'}</p>
            <p>Drift de digest: {selected.digestDrifted ? 'Sim' : 'Não'}</p>

            <section className="audit-results">
              <h4>Auditoria da stack</h4>
              <div className="table-tools">
                <input
                  placeholder="Filtrar por imagem"
                  value={auditFilter}
                  onChange={(event) => setAuditFilter(event.target.value)}
                  data-testid="audit.filter.actor.input"
                />
                <button type="button" data-testid="audit.export.button">
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
                        <td>{image.image}</td>
                        <td>{image.tag}</td>
                        <td>{image.digest ?? 'n/a'}</td>
                        <td>{image.registryDigest ?? 'n/a'}</td>
                        <td>
                          <span className={`badge ${image.drifted ? 'warn' : 'ok'}`}>
                            {image.drifted ? 'Drift' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
