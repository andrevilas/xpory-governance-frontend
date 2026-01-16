import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { fetchInstances, PortainerInstance } from '../../services/instances';
import {
  createStackLocal,
  createStackLocalVariable,
  createStackLocalVersion,
  deleteInstanceVariable,
  deleteStackLocal,
  deleteStackLocalVariable,
  deployStackLocal,
  DeployStackLocalResult,
  fetchStackInstanceVariables,
  fetchStackLocalPreview,
  fetchStackLocalVariables,
  fetchStackLocalVersions,
  fetchStacksLocal,
  StackInstanceVariable,
  StackLocal,
  StackLocalPreview,
  StackLocalVariable,
  StackLocalVersion,
  updateStackLocal,
  upsertInstanceVariable,
} from '../../services/stacksLocal';
import './stacks-local.css';

type StackFormState = {
  name: string;
  description: string;
  composeTemplate: string;
  currentVersion: string;
};

type VariableFormState = {
  variableName: string;
  description: string;
  defaultValue: string;
  isRequired: boolean;
};

type VersionFormState = {
  version: string;
  description: string;
  createdBy: string;
};

const emptyForm: StackFormState = {
  name: '',
  description: '',
  composeTemplate: '',
  currentVersion: '',
};

const emptyVariableForm: VariableFormState = {
  variableName: '',
  description: '',
  defaultValue: '',
  isRequired: false,
};

const emptyVersionForm: VersionFormState = {
  version: '',
  description: '',
  createdBy: '',
};

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');

export function StacksLocalPage(): JSX.Element {
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<StackFormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instances, setInstances] = useState<PortainerInstance[]>([]);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [variables, setVariables] = useState<StackLocalVariable[]>([]);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [variableForm, setVariableForm] = useState<VariableFormState>(emptyVariableForm);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instanceVariables, setInstanceVariables] = useState<StackInstanceVariable[]>([]);
  const [instanceVarDrafts, setInstanceVarDrafts] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<StackLocalVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionForm, setVersionForm] = useState<VersionFormState>(emptyVersionForm);
  const [deploySelection, setDeploySelection] = useState<string[]>([]);
  const [deployDryRun, setDeployDryRun] = useState(true);
  const [deployUserId, setDeployUserId] = useState('');
  const [deployTargetVersion, setDeployTargetVersion] = useState('');
  const [previewResults, setPreviewResults] = useState<StackLocalPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deployResults, setDeployResults] = useState<DeployStackLocalResult[]>([]);
  const [deployLoading, setDeployLoading] = useState(false);

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

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId],
  );

  const instanceVariableMap = useMemo(() => {
    const map = new Map<string, StackInstanceVariable>();
    instanceVariables.forEach((entry) => map.set(entry.variableName, entry));
    return map;
  }, [instanceVariables]);

  const versionOptions = useMemo(() => {
    const list = [...versions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((version) => version.version);
    return Array.from(new Set(list));
  }, [versions]);

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
      setVariablesError('Falha ao carregar variáveis da stack.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const loadVersions = async (stackId: string) => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const result = await fetchStackLocalVersions(stackId);
      setVersions(result);
    } catch (err) {
      void err;
      setVersionsError('Falha ao carregar histórico de versões.');
    } finally {
      setVersionsLoading(false);
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
      setVersions([]);
      setInstanceVariables([]);
      setInstanceVarDrafts({});
      setPreviewResults([]);
      setDeployResults([]);
      return;
    }
    void loadVariables(selectedStack.id);
    void loadVersions(selectedStack.id);
    setDeployTargetVersion(selectedStack.currentVersion ?? '');
  }, [selectedStack?.id]);

  useEffect(() => {
    if (!selectedStack || !selectedInstanceId) {
      setInstanceVariables([]);
      setInstanceVarDrafts({});
      return;
    }
    void loadInstanceVariables(selectedStack.id, selectedInstanceId);
  }, [selectedStack?.id, selectedInstanceId]);

  useEffect(() => {
    if (instances.length === 0) {
      setDeploySelection([]);
      return;
    }
    setDeploySelection((prev) => prev.filter((id) => instances.some((instance) => instance.id === id)));
  }, [instances]);

  const startEdit = (stack: StackLocal) => {
    setEditingId(stack.id);
    setForm({
      name: stack.name,
      description: stack.description ?? '',
      composeTemplate: stack.composeTemplate,
      currentVersion: stack.currentVersion ?? '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.composeTemplate.trim()) {
      setError('Preencha nome e template.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateStackLocal(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          composeTemplate: form.composeTemplate.trim(),
          currentVersion: form.currentVersion.trim() || null,
        });
      } else {
        await createStackLocal({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          composeTemplate: form.composeTemplate.trim(),
          currentVersion: form.currentVersion.trim() || undefined,
        });
      }
      await loadStacks();
      resetForm();
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(message ?? 'Falha ao salvar stack local.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stack: StackLocal) => {
    setSaving(true);
    setError(null);
    try {
      await deleteStackLocal(stack.id);
      await loadStacks();
      if (selectedId === stack.id) {
        setSelectedId(null);
      }
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(message ?? 'Falha ao remover stack local.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVariable = async () => {
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
      await createStackLocalVariable(selectedStack.id, {
        variableName: variableForm.variableName.trim(),
        description: variableForm.description.trim() || undefined,
        defaultValue: variableForm.defaultValue.trim() || undefined,
        isRequired: variableForm.isRequired,
      });
      setVariableForm(emptyVariableForm);
      await loadVariables(selectedStack.id);
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
      setVariablesError('Informe um valor ou utilize Limpar para remover override.');
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

  const handleCreateVersion = async () => {
    if (!selectedStack) {
      return;
    }
    if (!versionForm.version.trim()) {
      setVersionsError('Informe a versão.');
      return;
    }
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      await createStackLocalVersion(selectedStack.id, {
        version: versionForm.version.trim(),
        description: versionForm.description.trim() || undefined,
        createdBy: versionForm.createdBy.trim() || undefined,
        composeTemplate: selectedStack.composeTemplate,
      });
      setVersionForm(emptyVersionForm);
      await loadVersions(selectedStack.id);
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVersionsError(message ?? 'Falha ao salvar versão.');
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleApplyVersion = (version: StackLocalVersion) => {
    setForm((prev) => ({
      ...prev,
      composeTemplate: version.composeTemplate,
      currentVersion: version.version,
    }));
    setEditingId(selectedStack?.id ?? null);
  };

  const toggleDeployInstance = (instanceId: string) => {
    setDeploySelection((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const handlePreview = async () => {
    if (!selectedStack || deploySelection.length === 0) {
      setVariablesError('Selecione instâncias para preview.');
      return;
    }
    setPreviewLoading(true);
    setPreviewResults([]);
    try {
      const results = await Promise.all(
        deploySelection.map((instanceId) => fetchStackLocalPreview(selectedStack.id, instanceId)),
      );
      setPreviewResults(results);
    } catch (err) {
      void err;
      setVariablesError('Falha ao gerar preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedStack || deploySelection.length === 0) {
      setVariablesError('Selecione instâncias para deploy.');
      return;
    }
    setDeployLoading(true);
    setDeployResults([]);
    try {
      const results = await deployStackLocal(selectedStack.id, {
        instanceIds: deploySelection,
        dryRun: deployDryRun,
        userId: deployUserId.trim() || undefined,
        targetVersion: deployTargetVersion.trim() || undefined,
      });
      setDeployResults(results);
    } catch (err) {
      void err;
      setVariablesError('Falha ao executar deploy.');
    } finally {
      setDeployLoading(false);
    }
  };

  return (
    <AppLayout title="Stacks Globais">
      <div className="stacks-local-page">
        <section className="card">
          <h2>{editingId ? 'Editar stack' : 'Nova stack global'}</h2>
          {error && <div className="inline-alert">{error}</div>}
          <div className="form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="xpory-front"
              />
            </label>
            <label>
              Versão atual
              <input
                value={form.currentVersion}
                onChange={(event) => setForm((prev) => ({ ...prev, currentVersion: event.target.value }))}
                placeholder="1.2.0"
              />
            </label>
            <label>
              Descrição
              <input
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Stack front-end principal"
              />
            </label>
          </div>
          <label className="full">
            Template compose
            <textarea
              value={form.composeTemplate}
              onChange={(event) => setForm((prev) => ({ ...prev, composeTemplate: event.target.value }))}
              placeholder="version: '3.9'\nservices:\n  api:\n    image: xpory/api:{{VERSION}}"
              rows={10}
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </section>

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
                  <th>Acoes</th>
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
                    <td>
                      <div className="actions">
                        <button type="button" onClick={() => startEdit(stack)}>
                          Editar
                        </button>
                        <button type="button" className="danger" onClick={() => handleDelete(stack)}>
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

        {selectedStack && (
          <section className="card">
            <h2>Detalhes da stack</h2>
            <div className="details-grid">
              <div>
                <strong>ID</strong>
                <span>{selectedStack.id}</span>
              </div>
              <div>
                <strong>Versão atual</strong>
                <span>{selectedStack.currentVersion ?? 'n/a'}</span>
              </div>
              <div>
                <strong>Atualizada em</strong>
                <span>{formatDate(selectedStack.updatedAt)}</span>
              </div>
            </div>
            <div className="template-preview">
              <strong>Template atual</strong>
              <pre>{selectedStack.composeTemplate}</pre>
            </div>
          </section>
        )}

        <section className="card">
          <h2>Variáveis declaradas</h2>
          {variablesError && <div className="inline-alert">{variablesError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para gerenciar variáveis.</div>
          ) : (
            <>
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
                <button type="button" onClick={handleCreateVariable} disabled={variablesLoading}>
                  {variablesLoading ? 'Salvando...' : 'Adicionar variável'}
                </button>
              </div>
              {variablesLoading ? (
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
            </>
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
            <div className="empty-state">Selecione uma stack para editar variáveis.</div>
          ) : instances.length === 0 ? (
            <div className="empty-state">Nenhuma instância cadastrada.</div>
          ) : !selectedInstanceId ? (
            <div className="empty-state">Escolha uma instância para visualizar variáveis.</div>
          ) : variablesLoading ? (
            <div className="empty-state">Carregando...</div>
          ) : variables.length === 0 ? (
            <div className="empty-state">Cadastre variáveis para editar overrides.</div>
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
          {selectedStack && selectedInstance && (
            <div className="hint">
              Versão ativa (stack): <strong>{selectedStack.currentVersion ?? 'n/a'}</strong>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Versões e histórico</h2>
          {versionsError && <div className="inline-alert">{versionsError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para gerenciar versões.</div>
          ) : (
            <>
              <div className="form-grid">
                <label>
                  Versão
                  <input
                    value={versionForm.version}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, version: event.target.value }))}
                    placeholder="1.2.1"
                  />
                </label>
                <label>
                  Responsável
                  <input
                    value={versionForm.createdBy}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, createdBy: event.target.value }))}
                    placeholder="usuario@xpory.io"
                  />
                </label>
                <label>
                  Descrição
                  <input
                    value={versionForm.description}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Fix de variáveis"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={handleCreateVersion} disabled={versionsLoading}>
                  {versionsLoading ? 'Salvando...' : 'Criar snapshot da versão atual'}
                </button>
              </div>
              {versionsLoading ? (
                <div className="empty-state">Carregando...</div>
              ) : versions.length === 0 ? (
                <div className="empty-state">Nenhuma versão registrada.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Versão</th>
                      <th>Descrição</th>
                      <th>Responsável</th>
                      <th>Criado em</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...versions]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((version) => (
                        <tr key={version.id}>
                          <td>
                            <span className="pill">{version.version}</span>
                          </td>
                          <td>{version.description ?? 'n/a'}</td>
                          <td>{version.createdBy ?? 'n/a'}</td>
                          <td>{formatDate(version.createdAt)}</td>
                          <td>
                            <div className="actions">
                              <button type="button" onClick={() => handleApplyVersion(version)}>
                                Carregar no editor
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>

        <section className="card">
          <h2>Deploy unificado + preview</h2>
          {variablesError && <div className="inline-alert">{variablesError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para iniciar um deploy.</div>
          ) : instances.length === 0 ? (
            <div className="empty-state">Cadastre instâncias antes de iniciar o deploy.</div>
          ) : (
            <>
              <div className="deploy-grid">
                <div>
                  <strong>Instâncias alvo</strong>
                  <div className="instance-list">
                    {instances.map((instance) => {
                      const isSelected = deploySelection.includes(instance.id);
                      return (
                        <label key={instance.id} className={`instance-row ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDeployInstance(instance.id)}
                          />
                          <span>
                            {instance.name} ({instance.environment})
                          </span>
                          <span className="pill">{deployTargetVersion || selectedStack.currentVersion || 'n/a'}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="deploy-controls">
                  <label>
                    Target version
                    <select
                      value={deployTargetVersion}
                      onChange={(event) => setDeployTargetVersion(event.target.value)}
                    >
                      <option value="">Usar versão atual</option>
                      {versionOptions.map((version) => (
                        <option key={version} value={version}>
                          {version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Usuário solicitante
                    <input
                      value={deployUserId}
                      onChange={(event) => setDeployUserId(event.target.value)}
                      placeholder="usuario@xpory.io"
                    />
                  </label>
                  <label className="inline">
                    Dry-run
                    <input
                      type="checkbox"
                      checked={deployDryRun}
                      onChange={(event) => setDeployDryRun(event.target.checked)}
                    />
                  </label>
                  <div className="form-actions">
                    <button type="button" onClick={handlePreview} disabled={previewLoading}>
                      {previewLoading ? 'Gerando...' : 'Gerar preview'}
                    </button>
                    <button type="button" className="secondary" onClick={handleDeploy} disabled={deployLoading}>
                      {deployLoading ? 'Executando...' : 'Executar deploy'}
                    </button>
                  </div>
                </div>
              </div>
              {previewResults.length > 0 && (
                <div className="preview-grid">
                  {previewResults.map((preview) => (
                    <div key={preview.instanceId} className="preview-card">
                      <h3>
                        Preview {instances.find((instance) => instance.id === preview.instanceId)?.name ?? preview.instanceId}
                      </h3>
                      <div className="preview-meta">
                        <span className={`pill ${preview.isValid ? 'pill-valid' : 'pill-warning'}`}>
                          {preview.isValid ? 'Valido' : 'Com pendencias'}
                        </span>
                        {preview.missingVariables.length > 0 && (
                          <span className="pill pill-warning">Faltando: {preview.missingVariables.join(', ')}</span>
                        )}
                        {preview.unknownVariables.length > 0 && (
                          <span className="pill pill-warning">Desconhecidas: {preview.unknownVariables.join(', ')}</span>
                        )}
                      </div>
                      <pre>{preview.resolvedTemplate}</pre>
                    </div>
                  ))}
                </div>
              )}
              {deployResults.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Instância</th>
                      <th>Status</th>
                      <th>Mensagem</th>
                      <th>Rollback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployResults.map((result) => (
                      <tr key={result.instanceId}>
                        <td>{instances.find((instance) => instance.id === result.instanceId)?.name ?? result.instanceId}</td>
                        <td>
                          <span className={`pill pill-${result.status}`}>{result.status}</span>
                        </td>
                        <td>
                          {result.message}
                          {result.errors.length > 0 && (
                            <div className="stack-description">{result.errors.join(' | ')}</div>
                          )}
                        </td>
                        <td>{result.rollbackApplied ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
