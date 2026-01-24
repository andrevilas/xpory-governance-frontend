import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppLayout } from '../../components/layout/AppLayout';
import { AuditResult, fetchAuditResultsAll, fetchAuditRuns, JobRun } from '../../services/audit';
import '../dashboard/dashboard.css';

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

export function AuditingPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<AuditResult[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stackFilter, setStackFilter] = useState('');
  const [instanceFilter, setInstanceFilter] = useState('');
  const [imageFilter, setImageFilter] = useState('');
  const [failedOnly, setFailedOnly] = useState(searchParams.get('failed') === 'true');

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const [data, runData] = await Promise.all([
          fetchAuditResultsAll({
            stackName: stackFilter || undefined,
            instanceName: instanceFilter || undefined,
            riskLevel: failedOnly ? 'indisponivel' : undefined,
            limit: 500,
          }),
          fetchAuditRuns(50),
        ]);
        const filteredRuns = failedOnly ? runData.filter((run) => run.status === 'failed') : runData;
        setResults(data);
        setRuns(filteredRuns);
      } catch (err) {
        void err;
        setError('Não foi possível carregar auditorias.');
      } finally {
        setLoading(false);
      }
    };

    void loadResults();
  }, [stackFilter, instanceFilter, failedOnly]);

  const filteredResults = useMemo(() => {
    if (!imageFilter) {
      return results;
    }
    const needle = imageFilter.toLowerCase();
    return results.filter((item) => item.image.toLowerCase().includes(needle));
  }, [results, imageFilter]);

  const runStatusLabel = (status: string) => (status === 'success' ? 'OK' : 'Falhou');

  return (
    <AppLayout title="Auditorias">
      <div className="dashboard">
        {error && <div className="inline-alert">{error}</div>}
        <section className="section">
          <h2>Execuções de auditoria</h2>
          <p className="helper-text">
            {failedOnly
              ? 'Exibindo apenas execuções com falha.'
              : 'Exibindo as execuções mais recentes.'}
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Status</th>
                <th>Stacks</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Carregando...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nenhuma execução encontrada.</td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td>{formatDateTime(run.createdAt)}</td>
                    <td>{runStatusLabel(run.status)}</td>
                    <td>{run.stacksCount}</td>
                    <td>{run.error ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="section">
          <h2>Resultados de auditoria</h2>
          <div className="table-tools stacks-filters">
            <label className="form-field">
              Stack
              <input
                value={stackFilter}
                onChange={(event) => setStackFilter(event.target.value)}
                placeholder="Buscar stack"
              />
            </label>
            <label className="form-field">
              Instância
              <input
                value={instanceFilter}
                onChange={(event) => setInstanceFilter(event.target.value)}
                placeholder="Buscar instância"
              />
            </label>
            <label className="form-field">
              Imagem
              <input
                value={imageFilter}
                onChange={(event) => setImageFilter(event.target.value)}
                placeholder="Buscar imagem"
              />
            </label>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={failedOnly}
                onChange={(event) => setFailedOnly(event.target.checked)}
              />
              Com falha
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Stack</th>
                <th>Instância</th>
                <th>Endpoint</th>
                <th>Imagem</th>
                <th>Atual</th>
                <th>Última</th>
                <th>Status</th>
                <th>Risco</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>Carregando...</td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9}>Nenhum resultado encontrado.</td>
                </tr>
              ) : (
                filteredResults.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.stackName ?? item.stackUuid}</td>
                    <td>{item.instanceName ?? 'n/a'}</td>
                    <td>{item.endpointId ?? 'n/a'}</td>
                    <td>{item.image}</td>
                    <td>{item.currentTag}</td>
                    <td>{item.latestTag}</td>
                    <td>{item.updateAvailable ? 'Atualização' : 'OK'}</td>
                    <td>{item.riskLevel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </AppLayout>
  );
}
