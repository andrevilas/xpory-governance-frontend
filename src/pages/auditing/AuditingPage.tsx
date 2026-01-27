import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AppLayout } from '../../components/layout/AppLayout';
import { AuditResult, fetchAuditResultsAll } from '../../services/audit';
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
        const data = await fetchAuditResultsAll({
          stackName: stackFilter || undefined,
          instanceName: instanceFilter || undefined,
          riskLevel: failedOnly ? 'indisponivel' : undefined,
          limit: 500,
        });
        setResults(data);
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

  const statusBadgeClass = (item: AuditResult) => (item.updateAvailable ? 'warn' : 'ok');
  const riskBadgeClass = (riskLevel?: string | null) => {
    const normalized = (riskLevel ?? '').toLowerCase();
    if (!normalized) {
      return 'neutral';
    }
    if (
      normalized.includes('indispon') ||
      normalized.includes('crit') ||
      normalized.includes('alto') ||
      normalized.includes('grave')
    ) {
      return 'problem';
    }
    if (normalized.includes('medio') || normalized.includes('moder') || normalized.includes('alerta')) {
      return 'warn';
    }
    return 'ok';
  };

  return (
    <AppLayout title="Auditorias">
      <div className="dashboard">
        {error && <div className="inline-alert">{error}</div>}
        <section className="section">
          <h2>Resultados de auditoria</h2>
          <div className="table-tools stacks-filters">
            <label className="form-field">
              Stack
              <input
                data-testid="auditing.filter.stack.input"
                value={stackFilter}
                onChange={(event) => setStackFilter(event.target.value)}
                placeholder="Buscar stack"
              />
            </label>
            <label className="form-field">
              Instância
              <input
                data-testid="auditing.filter.instance.input"
                value={instanceFilter}
                onChange={(event) => setInstanceFilter(event.target.value)}
                placeholder="Buscar instância"
              />
            </label>
            <label className="form-field">
              Imagem
              <input
                data-testid="auditing.filter.image.input"
                value={imageFilter}
                onChange={(event) => setImageFilter(event.target.value)}
                placeholder="Buscar imagem"
              />
            </label>
            <label className="filter-toggle">
              <input
                data-testid="auditing.filter.failed.toggle"
                type="checkbox"
                checked={failedOnly}
                onChange={(event) => setFailedOnly(event.target.checked)}
              />
              Com falha
            </label>
          </div>
          <table className="table" data-testid="auditing.results.table">
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
                    <td>
                      <span className="badge neutral">{item.stackName ?? item.stackUuid}</span>
                    </td>
                    <td>{item.instanceName ?? 'n/a'}</td>
                    <td>{item.endpointId ?? 'n/a'}</td>
                    <td>
                      <span className="badge neutral">{item.image}</span>
                    </td>
                    <td>
                      <span className="badge neutral">{item.currentTag}</span>
                    </td>
                    <td>
                      <span className="badge neutral">{item.latestTag}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(item)}`}>
                        {item.updateAvailable ? 'Atualização' : 'OK'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${riskBadgeClass(item.riskLevel)}`}>
                        {item.riskLevel || 'n/a'}
                      </span>
                    </td>
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
