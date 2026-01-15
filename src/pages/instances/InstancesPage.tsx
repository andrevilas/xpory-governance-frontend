import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import {
  createInstance,
  deleteInstance,
  fetchInstances,
  PortainerInstance,
  updateInstance,
} from '../../services/instances';
import './instances.css';

type FormState = {
  name: string;
  baseUrl: string;
  token: string;
  username: string;
  password: string;
  environment: string;
  validateConnection: boolean;
};

const emptyForm: FormState = {
  name: '',
  baseUrl: '',
  token: '',
  username: '',
  password: '',
  environment: '',
  validateConnection: true,
};

export function InstancesPage(): JSX.Element {
  const [instances, setInstances] = useState<PortainerInstance[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedInstances = useMemo(
    () => [...instances].sort((a, b) => a.name.localeCompare(b.name)),
    [instances],
  );

  const filteredInstances = useMemo(() => {
    return sortedInstances.filter((instance) => {
      const matchesSearch =
        !search ||
        instance.name.toLowerCase().includes(search.toLowerCase()) ||
        instance.baseUrl.toLowerCase().includes(search.toLowerCase());
      const matchesEnv = !environmentFilter || instance.environment === environmentFilter;
      return matchesSearch && matchesEnv;
    });
  }, [sortedInstances, search, environmentFilter]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId],
  );

  const loadInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInstances();
      setInstances(result);
      setSelectedId((prev) => prev ?? result[0]?.id ?? null);
    } catch (err) {
      void err;
      setError('Não foi possível carregar instâncias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInstances();
  }, []);

  const startEdit = (instance: PortainerInstance) => {
    setEditingId(instance.id);
    setForm({
      name: instance.name,
      baseUrl: instance.baseUrl,
      token: '',
      username: '',
      password: '',
      environment: instance.environment,
      validateConnection: true,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    const hasToken = Boolean(form.token.trim());
    const hasCredentials = Boolean(form.username.trim() && form.password.trim());
    if (!form.name.trim() || !form.baseUrl.trim() || !form.environment.trim()) {
      setError('Preencha nome, URL e ambiente.');
      return;
    }
    if (!editingId && !hasToken && !hasCredentials) {
      setError('Informe token ou usuário e senha.');
      return;
    }
    if (editingId && (form.username.trim() || form.password.trim()) && !hasCredentials) {
      setError('Informe usuário e senha.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateInstance(editingId, {
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          environment: form.environment.trim(),
          token: form.token.trim() || undefined,
          username: form.username.trim() || undefined,
          password: form.password.trim() || undefined,
          validateConnection: form.validateConnection,
        });
      } else {
        await createInstance({
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          environment: form.environment.trim(),
          token: form.token.trim(),
          username: form.username.trim() || undefined,
          password: form.password.trim() || undefined,
          validateConnection: form.validateConnection,
        });
      }
      await loadInstances();
      resetForm();
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(message ?? 'Falha ao salvar instância.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (instance: PortainerInstance) => {
    setError(null);
    setSaving(true);
    try {
      await deleteInstance(instance.id);
      await loadInstances();
      if (editingId === instance.id) {
        resetForm();
      }
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(message ?? 'Falha ao remover instância.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Instâncias">
      <div className="instances-page">
        <section className="card">
          <h2>{editingId ? 'Editar instância' : 'Cadastrar instância'}</h2>
          {error && <div className="inline-alert">{error}</div>}
          <div className="form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Portainer Homolog"
              />
            </label>
            <label>
              URL base
              <input
                value={form.baseUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://portainer.example.com"
              />
            </label>
            <label>
              Ambiente
              <input
                value={form.environment}
                onChange={(event) => setForm((prev) => ({ ...prev, environment: event.target.value }))}
                placeholder="homolog"
              />
            </label>
            <label>
              Token
              <input
                value={form.token}
                onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))}
                placeholder={editingId ? 'Deixe em branco para manter' : 'Token API'}
              />
            </label>
            <label>
              Usuário
              <input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder={editingId ? 'Deixe em branco para manter' : 'usuario@empresa.com'}
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={editingId ? 'Deixe em branco para manter' : 'Senha da instância'}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.validateConnection}
                onChange={(event) => setForm((prev) => ({ ...prev, validateConnection: event.target.checked }))}
              />
              Validar conexão ao salvar
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleSubmit} disabled={saving}>
              {editingId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editingId ? (
              <button type="button" className="secondary" onClick={resetForm} disabled={saving}>
                Cancelar
              </button>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2>Instâncias cadastradas</h2>
          <div className="table-tools">
            <input
              placeholder="Buscar por nome ou URL"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={environmentFilter}
              onChange={(event) => setEnvironmentFilter(event.target.value)}
            >
              <option value="">Todos os ambientes</option>
              {Array.from(new Set(instances.map((instance) => instance.environment))).map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p>Carregando instâncias...</p>
          ) : filteredInstances.length === 0 ? (
            <p>Nenhuma instância cadastrada.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Ambiente</th>
                  <th>URL</th>
                  <th>Atualizado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstances.map((instance) => (
                  <tr
                    key={instance.id}
                    className={selectedId === instance.id ? 'selected' : ''}
                    onClick={() => setSelectedId(instance.id)}
                  >
                    <td>{instance.name}</td>
                    <td>{instance.environment}</td>
                    <td>{instance.baseUrl}</td>
                    <td>{new Date(instance.updatedAt).toLocaleString()}</td>
                    <td className="actions">
                      <button type="button" onClick={() => startEdit(instance)} disabled={saving}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(instance)}
                        disabled={saving}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Detalhes da instância</h2>
          {selectedInstance ? (
            <div className="details-grid">
              <div>
                <strong>Nome</strong>
                <span>{selectedInstance.name}</span>
              </div>
              <div>
                <strong>Ambiente</strong>
                <span>{selectedInstance.environment}</span>
              </div>
              <div>
                <strong>URL base</strong>
                <span>{selectedInstance.baseUrl}</span>
              </div>
              <div>
                <strong>ID</strong>
                <span>{selectedInstance.id}</span>
              </div>
              <div>
                <strong>Criado em</strong>
                <span>{new Date(selectedInstance.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <strong>Atualizado em</strong>
                <span>{new Date(selectedInstance.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p>Selecione uma instância para ver detalhes.</p>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
