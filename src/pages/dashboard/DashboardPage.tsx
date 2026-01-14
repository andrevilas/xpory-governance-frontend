import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchAuditResults, AuditResult } from '../../services/audit';
import { fetchInventoryStacks, fetchInventorySummary, InventoryStack, InventorySummary } from '../../services/inventory';
import { fetchEndpoints, PortainerEndpoint } from '../../services/portainer';
import './dashboard.css';

type StackRow = {
  id: string;
  name: string;
  status: 'ok' | 'warn';
  version: string;
  endpointName: string;
};

export function DashboardPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);
  const [endpoints, setEndpoints] = useState<PortainerEndpoint[]>([]);
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [endpointsResult, stacksResult, summaryResult] = await Promise.all([
          fetchEndpoints(),
          fetchInventoryStacks(),
          fetchInventorySummary(),
        ]);
        setEndpoints(endpointsResult);
        setStacks(stacksResult);
        setSummary(summaryResult);
      } catch (err) {
        void err;
        setError('Nao foi possivel carregar dados do inventario.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const endpointMap = useMemo(() => {
    return new Map(endpoints.map((endpoint) => [endpoint.id, endpoint.name]));
  }, [endpoints]);

  const stackRows = useMemo<StackRow[]>(() => {
    return stacks.map((stack) => ({
      id: stack.id,
      name: stack.name,
      status: stack.outdated ? 'warn' : 'ok',
      version: stack.type ? String(stack.type) : 'N/A',
      endpointName: endpointMap.get(stack.endpointId) ?? `Endpoint ${stack.endpointId}`,
    }));
  }, [stacks, endpointMap]);

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

  const filteredStacks = useMemo(
    () => stackRows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [search, stackRows]
  );

  return (
    <AppLayout title="Dashboard">
      <div className="dashboard">
        <section className="card-grid">
          <div className="card">
            <h3>Instancias</h3>
            <div className="value">{loading ? '-' : summary?.endpoints ?? 0}</div>
          </div>
          <div className="card">
            <h3>Stacks monitoradas</h3>
            <div className="value">{loading ? '-' : summary?.stacks ?? 0}</div>
          </div>
          <div className="card">
            <h3>Auditorias em andamento</h3>
            <div className="value">0</div>
          </div>
          <div className="card">
            <h3>Risco elevado</h3>
            <div className="value">{loading ? '-' : summary?.outdatedStacks ?? 0}</div>
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
            />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Tipo</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredStacks.map((stack) => (
                <tr key={stack.id}>
                  <td>{stack.name}</td>
                  <td>{stack.endpointName}</td>
                  <td>
                    <span className={`badge ${stack.status}`}>
                      {stack.status === 'ok' ? 'OK' : 'Atenção'}
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
          <p>Ultima auditoria: {summary?.lastAuditAt ?? 'pendente'}</p>
          <p>Stacks desatualizadas: {summary?.outdatedStacks ?? 0}</p>
        </section>
      </div>

      {selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <header>
              <h3>{selected.name}</h3>
              <button type="button" onClick={() => setSelected(null)}>
                Fechar
              </button>
            </header>
            <p>Endpoint: {selected.endpointName}</p>
            <p>Status atual: {selected.status === 'ok' ? 'OK' : 'Atenção'}</p>
            <p>Tipo da stack: {selected.version}</p>
            <p>Ultima auditoria: {summary?.lastAuditAt ?? 'pendente'}</p>

            <section className="audit-results">
              <h4>Auditoria da stack</h4>
              {auditLoading ? (
                <p>Carregando auditoria...</p>
              ) : auditResults.length === 0 ? (
                <p>Nenhum resultado disponivel.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Imagem</th>
                      <th>Atual</th>
                      <th>Ultima</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResults.map((item) => (
                      <tr key={item.id}>
                        <td>{item.image}</td>
                        <td>{item.currentTag}</td>
                        <td>{item.latestTag}</td>
                        <td>{item.updateAvailable ? 'Update' : 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
