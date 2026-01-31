import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import {
  fetchRegistryRuns,
  fetchStackRegistryImages,
  runRegistry,
  RegistryImageState,
  RegistryRun,
  RegistryUpdateResult,
} from '../../services/registry';
import { executeUpdate, fetchCompose, UpdateResponse, validateCompose, ComposeValidation } from '../../services/update';
import { createRegistryUpdateAction } from '../../services/actions';
import { useActionNotifications } from '../../context/actions/useActionNotifications';
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
  const [composeValidation, setComposeValidation] = useState<ComposeValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [registryImages, setRegistryImages] = useState<RegistryImageState[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryRunLoading, setRegistryRunLoading] = useState(false);
  const [registryUpdateDryRun, setRegistryUpdateDryRun] = useState(true);
  const [registryUpdateLoading, setRegistryUpdateLoading] = useState(false);
  const [registryUpdateResult, setRegistryUpdateResult] = useState<RegistryUpdateResult | null>(null);
  const [registryRuns, setRegistryRuns] = useState<RegistryRun[]>([]);
  const { trackAction } = useActionNotifications();

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
      setError(null);
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

  const handleRegistryRun = async () => {
    setRegistryRunLoading(true);
    setRegistryError(null);
    try {
      await runRegistry();
      const runs = await fetchRegistryRuns(10);
      setRegistryRuns(runs);
      if (selected) {
        const refreshed = await fetchStackRegistryImages(selected.id);
        setRegistryImages(refreshed);
      }
    } catch (err) {
      void err;
      setRegistryError('Não foi possível atualizar o registry watcher.');
    } finally {
      setRegistryRunLoading(false);
    }
  };

  const handleRegistryUpdate = async () => {
    if (!selected) {
      return;
    }
    setRegistryUpdateLoading(true);
    setRegistryError(null);
    setRegistryUpdateResult(null);
    try {
      const response = await createRegistryUpdateAction({
        stackId: selected.id,
        dryRun: registryUpdateDryRun,
      });
      trackAction({
        id: response.actionId,
        type: 'update_stack',
        status: response.status,
        stackId: selected.id,
        instanceId: selected.instanceId,
        userId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stackName: selected.name,
        instanceLabel: selected.instanceName ?? undefined,
      });
    } catch (err) {
      void err;
      setRegistryError('Falha ao enfileirar update por digest.');
    } finally {
      setRegistryUpdateLoading(false);
    }
  };

  const handleApprove = () => {
    void (async () => {
      setValidating(true);
      setError(null);
      try {
        const result = await validateCompose(nextCompose);
        setComposeValidation(result);
        if (!result.valid) {
          setStatus('pending');
          return;
        }
        setStatus('approved');
      } catch (err) {
        void err;
        setError('Falha ao validar compose.');
        setStatus('pending');
      } finally {
        setValidating(false);
      }
    })();
  };

  const handleExecute = async (dryRun: boolean) => {
    if (!selected) {
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const validation = await validateCompose(nextCompose);
      setComposeValidation(validation);
      if (!validation.valid) {
        setStatus('pending');
        return;
      }
    } catch (err) {
      void err;
      setError('Falha ao validar compose.');
      setStatus('pending');
      return;
    } finally {
      setValidating(false);
    }
    setStatus('running');
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
              setError(null);
              setComposeValidation(null);
              setRegistryUpdateResult(null);
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
          <textarea
            value={nextCompose}
            onChange={(event) => {
              setNextCompose(event.target.value);
              setStatus('pending');
              setComposeValidation(null);
            }}
            rows={8}
          />
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
            <button type="button" disabled={!canApprove || validating} onClick={handleApprove}>
              Aprovar atualização
            </button>
            <button
              type="button"
              disabled={!canExecute || validating}
              onClick={() => handleExecute(true)}
              data-testid="update.deploy.dryrun.toggle"
            >
              Dry run
            </button>
            <button
              type="button"
              disabled={!canExecute || validating}
              onClick={() => handleExecute(false)}
              data-testid="update.deploy.submit.button"
            >
              Executar update
            </button>
          </div>
          <p className="status">Status atual: {status}</p>
          {composeValidation && !composeValidation.valid ? (
            <ul className="error-list">
              {composeValidation.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
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

        <section className="update-card">
          <h2>Digests em uso</h2>
          <p className="helper-text">
            Última execução do registry watcher:{' '}
            {lastRegistryRun
              ? `${formatDateTime(lastRegistryRun.createdAt)} · ${lastRegistryRun.status}`
              : 'n/a'}
          </p>
          <div className="actions">
            <button type="button" onClick={handleRegistryRun} disabled={registryRunLoading}>
              {registryRunLoading ? 'Atualizando registry...' : 'Atualizar registry watcher'}
            </button>
            <label className="checkbox-toggle">
              <input
                type="checkbox"
                checked={registryUpdateDryRun}
                onChange={(event) => setRegistryUpdateDryRun(event.target.checked)}
              />
              Dry-run
            </label>
            <button type="button" onClick={handleRegistryUpdate} disabled={registryUpdateLoading || !selected}>
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
              <h4>Log do refresh de imagens</h4>
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
    </AppLayout>
  );
}
