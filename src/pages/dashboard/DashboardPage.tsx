import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchEndpoints, fetchStacks, PortainerEndpoint, PortainerStack } from '../../services/portainer';
import './dashboard.css';

type StackRow = {
  id: number;
  name: string;
  status: 'ok' | 'warn';
  version: string;
  endpointName: string;
};

export function DashboardPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);
  const [endpoints, setEndpoints] = useState<PortainerEndpoint[]>([]);
  const [stacks, setStacks] = useState<PortainerStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [endpointsResult, stacksResult] = await Promise.all([
          fetchEndpoints(),
          fetchStacks(),
        ]);
        setEndpoints(endpointsResult);
        setStacks(stacksResult);
      } catch (err) {
        void err;
        setError('Nao foi possivel carregar dados do Portainer.');
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
      status: stack.status === 1 ? 'ok' : 'warn',
      version: stack.type ? String(stack.type) : 'N/A',
      endpointName: endpointMap.get(stack.endpointId) ?? `Endpoint ${stack.endpointId}`,
    }));
  }, [stacks, endpointMap]);

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
            <div className="value">{loading ? '-' : endpoints.length}</div>
          </div>
          <div className="card">
            <h3>Stacks monitoradas</h3>
            <div className="value">{loading ? '-' : stacks.length}</div>
          </div>
          <div className="card">
            <h3>Auditorias em andamento</h3>
            <div className="value">0</div>
          </div>
          <div className="card">
            <h3>Risco elevado</h3>
            <div className="value">0</div>
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
          <p>Resumo: 2 stacks com updates disponiveis, 1 com drift detectado.</p>
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
            <p>Ultima auditoria: pendente</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
