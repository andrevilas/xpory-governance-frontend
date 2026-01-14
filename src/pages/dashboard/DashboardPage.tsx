import { useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import './dashboard.css';

type StackRow = {
  id: number;
  name: string;
  status: 'ok' | 'warn';
  version: string;
};

const stacksMock: StackRow[] = [
  { id: 1, name: 'core-api', status: 'ok', version: '1.4.2' },
  { id: 2, name: 'billing', status: 'warn', version: '1.1.0' },
  { id: 3, name: 'notifications', status: 'ok', version: '2.0.3' },
];

export function DashboardPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StackRow | null>(null);

  const filteredStacks = useMemo(
    () => stacksMock.filter((row) => row.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <AppLayout title="Dashboard">
      <div className="dashboard">
        <section className="card-grid">
          <div className="card">
            <h3>Instancias</h3>
            <div className="value">12</div>
          </div>
          <div className="card">
            <h3>Stacks monitoradas</h3>
            <div className="value">32</div>
          </div>
          <div className="card">
            <h3>Auditorias em andamento</h3>
            <div className="value">3</div>
          </div>
          <div className="card">
            <h3>Risco elevado</h3>
            <div className="value">2</div>
          </div>
        </section>

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
                <th>Status</th>
                <th>Versao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredStacks.map((stack) => (
                <tr key={stack.id}>
                  <td>{stack.name}</td>
                  <td>
                    <span className={`badge ${stack.status}`}>
                      {stack.status === 'ok' ? 'OK' : 'Risco'}
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
            <p>Status atual: {selected.status === 'ok' ? 'OK' : 'Risco'}</p>
            <p>Versao atual: {selected.version}</p>
            <p>Ultima auditoria: 2h atras</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
