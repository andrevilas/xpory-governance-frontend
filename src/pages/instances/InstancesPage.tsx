import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import {
  createInstance,
  deleteInstance,
  fetchInstances,
  PortainerInstance,
  updateInstance,
} from '../../services/instances';
import {
  fetchStackInstanceVariables,
  fetchStackLocalVariables,
  fetchStacksLocal,
  StackInstanceVariable,
  StackLocal,
  StackLocalVariable,
  upsertInstanceVariable,
  deleteInstanceVariable,
} from '../../services/stacksLocal';
import { fetchInventoryStacks } from '../../services/inventory';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStacksModalOpen, setIsStacksModalOpen] = useState(false);
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [stackVariables, setStackVariables] = useState<StackLocalVariable[]>([]);
  const [instanceVariables, setInstanceVariables] = useState<StackInstanceVariable[]>([]);
  const [stackVarDrafts, setStackVarDrafts] = useState<Record<string, string>>({});
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksError, setStacksError] = useState<string | null>(null);

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

  const selectedStack = useMemo(
    () => stacks.find((stack) => stack.id === selectedStackId) ?? null,
    [stacks, selectedStackId],
  );

  const instanceVariableMap = useMemo(() => {
    const map = new Map<string, StackInstanceVariable>();
    instanceVariables.forEach((entry) => map.set(entry.variableName, entry));
    return map;
  }, [instanceVariables]);

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
    setError(null);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setError(null);
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
      setIsModalOpen(false);
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

  const openStacksModal = async (instance: PortainerInstance) => {
    setSelectedId(instance.id);
    setStacksError(null);
    setStacksLoading(true);
    setIsStacksModalOpen(true);
    try {
      const [stacksResult, inventoryStacks] = await Promise.all([
        fetchStacksLocal(),
        fetchInventoryStacks(),
      ]);
      const instanceStackNames = new Set(
        inventoryStacks
          .filter((stack) => stack.instanceId === instance.id)
          .map((stack) => stack.name.toLowerCase()),
      );
      const filteredStacks = stacksResult.filter((stack) =>
        instanceStackNames.has(stack.name.toLowerCase()),
      );
      setStacks(filteredStacks);
      setSelectedStackId((prev) => prev ?? filteredStacks[0]?.id ?? null);
    } catch (err) {
      void err;
      setStacksError('Não foi possível carregar stacks globais.');
    } finally {
      setStacksLoading(false);
    }
  };

  const closeStacksModal = () => {
    setIsStacksModalOpen(false);
    setStacks([]);
    setSelectedStackId(null);
    setStackVariables([]);
    setInstanceVariables([]);
    setStackVarDrafts({});
    setStacksError(null);
  };

  const loadStackVariables = async (stackId: string, instanceId: string) => {
    setStacksError(null);
    try {
      const [variablesResult, instanceVarsResult] = await Promise.all([
        fetchStackLocalVariables(stackId),
        fetchStackInstanceVariables(stackId, instanceId),
      ]);
      setStackVariables(variablesResult);
      setInstanceVariables(instanceVarsResult);
      const drafts: Record<string, string> = {};
      instanceVarsResult.forEach((entry) => {
        drafts[entry.variableName] = entry.value;
      });
      setStackVarDrafts(drafts);
    } catch (err) {
      void err;
      setStacksError('Falha ao carregar variáveis da stack.');
    }
  };

  useEffect(() => {
    if (!isStacksModalOpen || !selectedStackId || !selectedId) {
      return;
    }
    void loadStackVariables(selectedStackId, selectedId);
  }, [isStacksModalOpen, selectedStackId, selectedId]);

  const handleSaveStackVariables = async () => {
    if (!selectedStackId || !selectedId) {
      return;
    }
    setStacksError(null);
    setStacksLoading(true);
    try {
      await Promise.all(
        stackVariables.map(async (variable) => {
          const value = (stackVarDrafts[variable.variableName] ?? '').trim();
          const existing = instanceVariableMap.get(variable.variableName);
          if (!value) {
            if (existing) {
              await deleteInstanceVariable(selectedStackId, selectedId, variable.variableName);
            }
            return;
          }
          await upsertInstanceVariable(selectedStackId, selectedId, variable.variableName, value);
        }),
      );
      await loadStackVariables(selectedStackId, selectedId);
    } catch (err) {
      void err;
      setStacksError('Falha ao salvar variáveis da instância.');
    } finally {
      setStacksLoading(false);
    }
  };

  return (
    <AppLayout
      title="Instâncias"
      headerAction={
        <button type="button" className="header-button primary" onClick={openCreate}>
          Novo
        </button>
      }
    >
      <div className="instances-page">
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
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(instance);
                        }}
                        disabled={saving}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openStacksModal(instance);
                        }}
                        disabled={saving}
                      >
                        Stacks
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(instance);
                        }}
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

      <Modal
        isOpen={isModalOpen}
        title={editingId ? 'Editar instância' : 'Nova instância'}
        onClose={closeModal}
      >
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
          <button type="button" className="secondary" onClick={closeModal} disabled={saving}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isStacksModalOpen}
        title={`Stacks globais${selectedInstance ? ` · ${selectedInstance.name}` : ''}`}
        onClose={closeStacksModal}
      >
        {stacksError && <div className="inline-alert">{stacksError}</div>}
        {stacksLoading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <>
            <div className="form-grid">
              <label>
                Stack global
                <select
                  value={selectedStackId ?? ''}
                  onChange={(event) => setSelectedStackId(event.target.value || null)}
                  disabled={stacks.length === 0}
                >
                  {stacks.length === 0 ? (
                    <option value="">Nenhuma stack disponível</option>
                  ) : (
                    stacks.map((stack) => (
                      <option key={stack.id} value={stack.id}>
                        {stack.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>

            {selectedStackId && (
              <div className="stack-vars">
                {stackVariables.length === 0 ? (
                  <div className="empty-state">Nenhuma variável cadastrada para esta stack.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Variável</th>
                        <th>Obrigatória</th>
                        <th>Default</th>
                        <th>Valor na instância</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stackVariables.map((variable) => {
                        const instanceValue = stackVarDrafts[variable.variableName] ?? '';
                        return (
                          <tr key={variable.id}>
                            <td>
                              <div className="stack-name">{variable.variableName}</div>
                              <div className="stack-description">{variable.description ?? 'Sem descrição'}</div>
                            </td>
                            <td>{variable.isRequired ? 'Sim' : 'Não'}</td>
                            <td>{variable.defaultValue ?? 'n/a'}</td>
                            <td>
                              <input
                                value={instanceValue}
                                onChange={(event) =>
                                  setStackVarDrafts((prev) => ({
                                    ...prev,
                                    [variable.variableName]: event.target.value,
                                  }))
                                }
                                placeholder={variable.defaultValue ?? ''}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {!selectedStackId && stacks.length === 0 && (
              <div className="empty-state">Nenhuma stack global corresponde às stacks da instância.</div>
            )}
            <div className="form-actions">
              <button type="button" onClick={handleSaveStackVariables} disabled={stacksLoading || !selectedStack}>
                Salvar variáveis
              </button>
              <button type="button" className="secondary" onClick={closeStacksModal}>
                Fechar
              </button>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
