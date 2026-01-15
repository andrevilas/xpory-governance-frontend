import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { executeUpdate, fetchCompose, UpdateResponse } from '../../services/update';
import './update.css';

type UpdateStatus = 'pending' | 'approved' | 'running' | 'success' | 'failed';

type DiffRow = {
  id: number;
  before: string;
  after: string;
  changed: boolean;
};

export function UpdatePage(): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>('pending');
  const [stacks, setStacks] = useState<InventoryStack[]>([]);
  const [selected, setSelected] = useState<InventoryStack | null>(null);
  const [currentCompose, setCurrentCompose] = useState('');
  const [nextCompose, setNextCompose] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResponse | null>(null);

  const canApprove = status === 'pending';
  const canExecute = status === 'approved';

  useEffect(() => {
    const loadStacks = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchInventoryStacks();
        const filtered = result.filter(
          (stack) => !(stack.instanceName ?? '').toLowerCase().includes('seed'),
        );
        const nextStacks = filtered.length > 0 ? filtered : result;
        setStacks(nextStacks);
        setSelected(nextStacks[0] ?? null);
      } catch (err) {
        void err;
        setError('Não foi possível carregar stacks.');
      } finally {
        setLoading(false);
      }
    };

    void loadStacks();
  }, []);

  useEffect(() => {
    const loadCompose = async () => {
      if (!selected) {
        return;
      }
      try {
        const compose = await fetchCompose(selected.instanceId, selected.portainerStackId, selected.endpointId);
        setCurrentCompose(compose);
        setNextCompose(compose);
      } catch (err) {
        void err;
        setError('Não foi possível carregar compose atual.');
      }
    };

    void loadCompose();
  }, [selected]);

  const diffRows = useMemo<DiffRow[]>(() => {
    const beforeLines = currentCompose.split('\n');
    const afterLines = nextCompose.split('\n');
    const maxLines = Math.max(beforeLines.length, afterLines.length);
    const rows: DiffRow[] = [];
    for (let i = 0; i < maxLines; i += 1) {
      const before = beforeLines[i] ?? '';
      const after = afterLines[i] ?? '';
      rows.push({
        id: i,
        before,
        after,
        changed: before !== after,
      });
    }
    return rows;
  }, [currentCompose, nextCompose]);

  const healthIndicators = useMemo(
    () => [
      { label: 'Pre-update', value: updateResult?.steps.preHealth ? 'OK' : 'Pendente' },
      { label: 'Post-update', value: updateResult?.steps.postHealth ? 'OK' : 'Pendente' },
    ],
    [updateResult]
  );

  const handleApprove = () => {
    setStatus('approved');
  };

  const handleExecute = async (dryRun: boolean) => {
    if (!selected) {
      return;
    }
    setStatus('running');
    setError(null);
    try {
      const result = await executeUpdate(
        selected.instanceId,
        selected.portainerStackId,
        selected.endpointId,
        nextCompose,
        dryRun,
      );
      setUpdateResult(result);
      if (result.errors.length > 0) {
        setStatus('failed');
      } else {
        setStatus('success');
      }
    } catch (err) {
      void err;
      setError('Falha ao executar update.');
      setStatus('failed');
    }
  };

  return (
    <AppLayout title="Atualizações">
      <div className="update-page">
        <section className="update-card">
          <h2>Seleção de stack</h2>
          {error && <div className="inline-alert">{error}</div>}
          <select
            value={selected?.id ?? ''}
            onChange={(event) => {
              const next = stacks.find((stack) => stack.id === event.target.value) ?? null;
              setSelected(next);
              setStatus('pending');
              setUpdateResult(null);
            }}
            disabled={loading}
            data-testid="update.policies.table"
          >
            {stacks.map((stack) => (
              <option key={stack.id} value={stack.id}>
                {stack.name} ({stack.instanceName ?? 'Instância'} / endpoint {stack.endpointId})
              </option>
            ))}
          </select>
        </section>

        <section className="update-card">
          <h2>Compose atual</h2>
          <textarea value={currentCompose} readOnly rows={8} />
        </section>

        <section className="update-card">
          <h2>Novo compose</h2>
          <textarea value={nextCompose} onChange={(event) => setNextCompose(event.target.value)} rows={8} />
        </section>

        <section className="update-card">
          <h2>Diff do Compose</h2>
          <table className="diff-table">
            <thead>
              <tr>
                <th>Antes</th>
                <th>Depois</th>
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row) => (
                <tr key={row.id} className={row.changed ? 'changed' : ''}>
                  <td className="before">{row.before}</td>
                  <td className="after">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="update-card">
          <h2>Fluxo de aprovação</h2>
          <div className="actions">
            <button type="button" disabled={!canApprove} onClick={handleApprove}>
              Aprovar atualização
            </button>
            <button
              type="button"
              disabled={!canExecute}
              onClick={() => handleExecute(true)}
              data-testid="update.deploy.dryrun.toggle"
            >
              Dry run
            </button>
            <button
              type="button"
              disabled={!canExecute}
              onClick={() => handleExecute(false)}
              data-testid="update.deploy.submit.button"
            >
              Executar update
            </button>
          </div>
          <p className="status">Status atual: {status}</p>
          {updateResult?.errors?.length ? (
            <ul className="error-list">
              {updateResult.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="update-card">
          <h2>Indicadores de health</h2>
          <div className="health-grid">
            {healthIndicators.map((indicator) => (
              <div key={indicator.label} className="health-item">
                <span>{indicator.label}</span>
                <strong>{indicator.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
