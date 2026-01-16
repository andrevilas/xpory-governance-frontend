import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { fetchInstances, PortainerInstance } from '../../services/instances';
import {
  createStackLocalVariable,
  deleteInstanceVariable,
  deleteStackLocalVariable,
  fetchStackInstanceVariables,
  fetchStackLocalVariables,
  fetchStacksLocal,
  StackInstanceVariable,
  StackLocal,
  StackLocalVariable,
  updateStackLocalVariable,
  upsertInstanceVariable,
} from '../../services/stacksLocal';
import './stacks-local.css';

type VariableFormState = {
  variableName: string;
  description: string;
  defaultValue: string;
  isRequired: boolean;
};

const emptyVariableForm: VariableFormState = {
  variableName: '',
  description: '',
  defaultValue: '',
  isRequired: false,
};

const tabs = [
  { label: 'Stacks', path: '/app/stacks' },
  { label: 'Variáveis', path: '/app/stacks/variables' },
  { label: 'Versões', path: '/app/stacks/versions' },
];

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');

export function StacksLocalVariablesPage(): JSX.Element {
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<StackLocalVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [variableForm, setVariableForm] = useState<VariableFormState>(emptyVariableForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null);
  const [instances, setInstances] = useState<PortainerInstance[]>([]);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instanceVariables, setInstanceVariables] = useState<StackInstanceVariable[]>([]);
  const [instanceVarDrafts, setInstanceVarDrafts] = useState<Record<string, string>>({});

  const sortedStacks = useMemo(
    () => [...stacks].sort((a, b) => a.name.localeCompare(b.name)),
    [stacks],
  );

  const filteredStacks = useMemo(() => {
    return sortedStacks.filter((stack) => {
      const matchesSearch =
        !search ||
        stack.name.toLowerCase().includes(search.toLowerCase()) ||
        (stack.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesVersion = !versionFilter || stack.currentVersion === versionFilter;
      return matchesSearch && matchesVersion;
    });
  }, [sortedStacks, search, versionFilter]);

  const currentVersionOptions = useMemo(() => {
    const versionsSet = new Set<string>();
    stacks.forEach((stack) => {
      if (stack.currentVersion) {
        versionsSet.add(stack.currentVersion);
      }
    });
    return Array.from(versionsSet).sort();
  }, [stacks]);

  const selectedStack = useMemo(
    () => stacks.find((stack) => stack.id === selectedId) ?? null,
    [stacks, selectedId],
  );

  const instanceVariableMap = useMemo(() => {
    const map = new Map<string, StackInstanceVariable>();
    instanceVariables.forEach((entry) => map.set(entry.variableName, entry));
    return map;
  }, [instanceVariables]);

  const loadStacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStacksLocal();
      setStacks(result);
      setSelectedId((prev) => prev ?? result[0]?.id ?? null);
    } catch (err) {
      void err;
      setError('Não foi possível carregar stacks locais.');
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async () => {
    setInstancesError(null);
    try {
      const result = await fetchInstances();
      setInstances(result);
      setSelectedInstanceId((prev) => prev ?? result[0]?.id ?? null);
    } catch (err) {
      void err;
      setInstancesError('Não foi possível carregar instâncias.');
    }
  };

  const loadVariables = async (stackId: string) => {
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      const result = await fetchStackLocalVariables(stackId);
      setVariables(result);
    } catch (err) {
      void err;
      setVariablesError('Falha ao carregar variáveis do template.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const loadInstanceVariables = async (stackId: string, instanceId: string) => {
    setVariablesError(null);
    try {
      const result = await fetchStackInstanceVariables(stackId, instanceId);
      setInstanceVariables(result);
      const draft: Record<string, string> = {};
      result.forEach((entry) => {
        draft[entry.variableName] = entry.value;
      });
      setInstanceVarDrafts(draft);
    } catch (err) {
      void err;
      setVariablesError('Falha ao carregar variáveis da instância.');
    }
  };

  useEffect(() => {
    void loadStacks();
    void loadInstances();
  }, []);

  useEffect(() => {
    if (!selectedStack) {
      setVariables([]);
      setInstanceVariables([]);
      setInstanceVarDrafts({});
      return;
    }
    void loadVariables(selectedStack.id);
  }, [selectedStack?.id]);

  useEffect(() => {
    if (!selectedStack || !selectedInstanceId) {
      setInstanceVariables([]);
      setInstanceVarDrafts({});
      return;
    }
    void loadInstanceVariables(selectedStack.id, selectedInstanceId);
  }, [selectedStack?.id, selectedInstanceId]);

  const openModal = () => {
    setEditingVariableId(null);
    setVariableForm(emptyVariableForm);
    setVariablesError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (variable: StackLocalVariable) => {
    setEditingVariableId(variable.id);
    setVariableForm({
      variableName: variable.variableName,
      description: variable.description ?? '',
      defaultValue: variable.defaultValue ?? '',
      isRequired: variable.isRequired,
    });
    setVariablesError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setVariableForm(emptyVariableForm);
    setVariablesError(null);
    setEditingVariableId(null);
  };

  const handleSaveVariable = async () => {
    if (!selectedStack) {
      return;
    }
    if (!variableForm.variableName.trim()) {
      setVariablesError('Informe o nome da variável.');
      return;
    }
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      if (editingVariableId) {
        await updateStackLocalVariable(selectedStack.id, editingVariableId, {
          variableName: variableForm.variableName.trim(),
          description: variableForm.description.trim() || null,
          defaultValue: variableForm.defaultValue.trim() || null,
          isRequired: variableForm.isRequired,
        });
      } else {
        await createStackLocalVariable(selectedStack.id, {
          variableName: variableForm.variableName.trim(),
          description: variableForm.description.trim() || undefined,
          defaultValue: variableForm.defaultValue.trim() || undefined,
          isRequired: variableForm.isRequired,
        });
      }
      await loadVariables(selectedStack.id);
      closeModal();
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao salvar variável.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleDeleteVariable = async (variable: StackLocalVariable) => {
    if (!selectedStack) {
      return;
    }
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      await deleteStackLocalVariable(selectedStack.id, variable.id);
      await loadVariables(selectedStack.id);
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao remover variável.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleSaveInstanceVariable = async (variable: StackLocalVariable) => {
    if (!selectedStack || !selectedInstanceId) {
      return;
    }
    const value = instanceVarDrafts[variable.variableName]?.trim() ?? '';
    if (!value) {
      setVariablesError('Informe um valor ou use Limpar para remover override.');
      return;
    }
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      const result = await upsertInstanceVariable(selectedStack.id, selectedInstanceId, variable.variableName, value);
      setInstanceVariables((prev) => {
        const updated = prev.filter((entry) => entry.variableName !== result.variableName);
        return [...updated, result];
      });
      setInstanceVarDrafts((prev) => ({ ...prev, [variable.variableName]: result.value }));
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao salvar variável por instância.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleClearInstanceVariable = async (variable: StackLocalVariable) => {
    if (!selectedStack || !selectedInstanceId) {
      return;
    }
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      await deleteInstanceVariable(selectedStack.id, selectedInstanceId, variable.variableName);
      setInstanceVariables((prev) => prev.filter((entry) => entry.variableName !== variable.variableName));
      setInstanceVarDrafts((prev) => ({ ...prev, [variable.variableName]: '' }));
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao limpar variável por instância.');
    } finally {
      setVariablesLoading(false);
    }
  };

  return (
    <AppLayout
      title="Stacks / Variáveis"
      headerAction={
        <button type="button" className="header-button primary" onClick={openModal}>
          Novo
        </button>
      }
    >
      <div className="stacks-local-page">
        <PageTabs tabs={tabs} />
        {error && <div className="inline-alert">{error}</div>}
        <section className="card">
          <div className="card-header">
            <h2>Stacks cadastradas</h2>
            <div className="table-tools">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou descrição"
              />
              <select value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)}>
                <option value="">Todas as versões</option>
                {currentVersionOptions.map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">Carregando...</div>
          ) : filteredStacks.length === 0 ? (
            <div className="empty-state">Nenhuma stack encontrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Stack</th>
                  <th>Versão atual</th>
                  <th>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredStacks.map((stack) => (
                  <tr
                    key={stack.id}
                    className={stack.id === selectedId ? 'selected' : ''}
                    onClick={() => setSelectedId(stack.id)}
                  >
                    <td>
                      <div className="stack-name">{stack.name}</div>
                      <div className="stack-description">{stack.description ?? 'Sem descrição'}</div>
                    </td>
                    <td>
                      <span className="pill">{stack.currentVersion ?? 'n/a'}</span>
                    </td>
                    <td>{formatDate(stack.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Variáveis declaradas</h2>
          {variablesError && <div className="inline-alert">{variablesError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para gerenciar variáveis do template.</div>
          ) : variablesLoading ? (
            <div className="empty-state">Carregando...</div>
          ) : variables.length === 0 ? (
            <div className="empty-state">Nenhuma variável cadastrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Variável</th>
                  <th>Obrigatoria</th>
                  <th>Default</th>
                  <th>Atualizado em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((variable) => (
                  <tr key={variable.id}>
                    <td>
                      <div className="stack-name">{variable.variableName}</div>
                      <div className="stack-description">{variable.description ?? 'Sem descrição'}</div>
                    </td>
                    <td>{variable.isRequired ? 'Sim' : 'Não'}</td>
                    <td>{variable.defaultValue ?? 'n/a'}</td>
                    <td>{formatDate(variable.updatedAt)}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => openEditModal(variable)}
                          disabled={variablesLoading}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDeleteVariable(variable)}
                          disabled={variablesLoading}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Variáveis por instância</h2>
            <div className="table-tools">
              <select
                value={selectedInstanceId ?? ''}
                onChange={(event) => setSelectedInstanceId(event.target.value || null)}
                disabled={instances.length === 0}
              >
                <option value="">Selecione uma instância</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} ({instance.environment})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {instancesError && <div className="inline-alert">{instancesError}</div>}
          {variablesError && <div className="inline-alert">{variablesError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para editar variáveis da instância.</div>
          ) : instances.length === 0 ? (
            <div className="empty-state">Nenhuma instância cadastrada.</div>
          ) : !selectedInstanceId ? (
            <div className="empty-state">Escolha uma instância para visualizar variáveis.</div>
          ) : variablesLoading ? (
            <div className="empty-state">Carregando...</div>
          ) : variables.length === 0 ? (
            <div className="empty-state">Cadastre variáveis para editar sobrescritas.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Variável</th>
                  <th>Obrigatoria</th>
                  <th>Default</th>
                  <th>Valor na instância</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((variable) => {
                  const instanceValue = instanceVarDrafts[variable.variableName] ?? '';
                  const instanceEntry = instanceVariableMap.get(variable.variableName);
                  const status = instanceEntry
                    ? 'Override'
                    : variable.defaultValue
                      ? 'Default'
                      : variable.isRequired
                        ? 'Pendente'
                        : 'Opcional';
                  return (
                    <tr key={variable.variableName}>
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
                            setInstanceVarDrafts((prev) => ({
                              ...prev,
                              [variable.variableName]: event.target.value,
                            }))
                          }
                          placeholder={variable.defaultValue ?? ''}
                        />
                        {instanceEntry && (
                          <div className="stack-description">Atualizado em {formatDate(instanceEntry.updatedAt)}</div>
                        )}
                      </td>
                      <td>
                        <span className={`pill pill-${status.toLowerCase()}`}>{status}</span>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            onClick={() => handleSaveInstanceVariable(variable)}
                            disabled={variablesLoading}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleClearInstanceVariable(variable)}
                            disabled={variablesLoading}
                          >
                            Limpar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        title={editingVariableId ? 'Editar variável' : 'Nova variável'}
        onClose={closeModal}
      >
        <div className="form-grid">
          <label>
            Nome
            <input
              value={variableForm.variableName}
              onChange={(event) =>
                setVariableForm((prev) => ({ ...prev, variableName: event.target.value }))
              }
              placeholder="VERSION"
            />
          </label>
          <label>
            Default
            <input
              value={variableForm.defaultValue}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, defaultValue: event.target.value }))}
              placeholder="1.0.0"
            />
          </label>
          <label>
            Descrição
            <input
              value={variableForm.description}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Versão da imagem"
            />
          </label>
          <label className="inline">
            Obrigatoria
            <input
              type="checkbox"
              checked={variableForm.isRequired}
              onChange={(event) => setVariableForm((prev) => ({ ...prev, isRequired: event.target.checked }))}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleSaveVariable} disabled={variablesLoading}>
            {variablesLoading ? 'Salvando...' : editingVariableId ? 'Atualizar' : 'Salvar'}
          </button>
          <button type="button" className="secondary" onClick={closeModal}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
