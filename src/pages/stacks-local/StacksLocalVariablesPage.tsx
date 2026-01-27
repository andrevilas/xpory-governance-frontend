import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { fetchInstances, PortainerInstance } from '../../services/instances';
import {
  createStackLocalVariable,
  deleteStackLocalVariablesBulk,
  deleteInstanceVariable,
  deleteStackLocalVariable,
  fetchStackInstanceVariables,
  fetchStackLocalVariables,
  fetchStackLocalVersions,
  fetchStacksLocal,
  StackInstanceVariable,
  StackLocal,
  StackLocalVariable,
  StackLocalVersion,
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

type InstanceVariableRow = {
  variableName: string;
  description: string | null;
  defaultValue: string | null;
  isRequired: boolean;
  isDeclared: boolean;
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
const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const extractTemplateVariables = (template: string): string[] => {
  if (!template) {
    return [];
  }
  const matches = template.match(TEMPLATE_VARIABLE_PATTERN) ?? [];
  const names = matches.map((match) => match.replace(/[{}]/g, '').trim());
  return Array.from(new Set(names));
};

export function StacksLocalVariablesPage(): JSX.Element {
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<StackLocalVariable[]>([]);
  const [variablesSearch, setVariablesSearch] = useState('');
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
  const [instanceSearch, setInstanceSearch] = useState('');
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [versions, setVersions] = useState<StackLocalVersion[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedVariableIds, setSelectedVariableIds] = useState<string[]>([]);

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

  const filteredVariables = useMemo(() => {
    if (!variablesSearch.trim()) {
      return variables;
    }
    const needle = variablesSearch.toLowerCase();
    return variables.filter(
      (variable) =>
        variable.variableName.toLowerCase().includes(needle) ||
        (variable.description ?? '').toLowerCase().includes(needle),
    );
  }, [variables, variablesSearch]);

  const selectedStack = useMemo(
    () => stacks.find((stack) => stack.id === selectedId) ?? null,
    [stacks, selectedId],
  );

  const selectedVersionRecord = useMemo(() => {
    if (!selectedVersion) {
      return null;
    }
    return versions.find((version) => version.version === selectedVersion) ?? null;
  }, [versions, selectedVersion]);

  const activeTemplate = useMemo(() => {
    if (selectedVersionRecord?.composeTemplate) {
      return selectedVersionRecord.composeTemplate;
    }
    return selectedStack?.composeTemplate ?? '';
  }, [selectedVersionRecord, selectedStack?.composeTemplate]);

  const templateVariables = useMemo(() => extractTemplateVariables(activeTemplate), [activeTemplate]);
  const templateVariableSet = useMemo(() => new Set(templateVariables), [templateVariables]);

  const versionCompatibleVariables = useMemo(() => {
    if (templateVariableSet.size === 0) {
      return [];
    }
    return variables.filter((variable) => templateVariableSet.has(variable.variableName));
  }, [variables, templateVariableSet]);

  const versionFilteredVariables = useMemo(() => {
    if (!variablesSearch.trim()) {
      return versionCompatibleVariables;
    }
    const needle = variablesSearch.toLowerCase();
    return versionCompatibleVariables.filter(
      (variable) =>
        variable.variableName.toLowerCase().includes(needle) ||
        (variable.description ?? '').toLowerCase().includes(needle),
    );
  }, [variablesSearch, versionCompatibleVariables]);

  const versionFilteredInstanceVariables = useMemo(() => {
    if (templateVariableSet.size === 0) {
      return [];
    }
    return instanceVariables.filter((entry) => templateVariableSet.has(entry.variableName));
  }, [instanceVariables, templateVariableSet]);

  const allSelected = useMemo(() => {
    if (versionFilteredVariables.length === 0) {
      return false;
    }
    return versionFilteredVariables.every((variable) => selectedVariableIds.includes(variable.id));
  }, [versionFilteredVariables, selectedVariableIds]);

  const selectedCount = selectedVariableIds.length;

  const instanceRows = useMemo<InstanceVariableRow[]>(() => {
    const declared = new Map<string, InstanceVariableRow>();
    versionCompatibleVariables.forEach((variable) => {
      declared.set(variable.variableName, {
        variableName: variable.variableName,
        description: variable.description ?? null,
        defaultValue: variable.defaultValue ?? null,
        isRequired: variable.isRequired,
        isDeclared: true,
      });
    });
    versionFilteredInstanceVariables.forEach((entry) => {
      if (declared.has(entry.variableName)) {
        return;
      }
      declared.set(entry.variableName, {
        variableName: entry.variableName,
        description: null,
        defaultValue: null,
        isRequired: false,
        isDeclared: false,
      });
    });
    return Array.from(declared.values()).sort((a, b) => a.variableName.localeCompare(b.variableName));
  }, [versionCompatibleVariables, versionFilteredInstanceVariables]);

  const filteredInstanceVariables = useMemo(() => {
    if (!instanceSearch.trim()) {
      return instanceRows;
    }
    const needle = instanceSearch.toLowerCase();
    return instanceRows.filter(
      (variable) =>
        variable.variableName.toLowerCase().includes(needle) ||
        (variable.description ?? '').toLowerCase().includes(needle),
    );
  }, [instanceRows, instanceSearch]);

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

  const loadVersions = async (
    stackId: string,
    currentVersion?: string | null,
    fallbackTemplate?: string,
    fallbackUpdatedAt?: string,
  ) => {
    setVersionsError(null);
    try {
      const result = await fetchStackLocalVersions(stackId);
      const list = [...result];
      if (currentVersion && !list.some((version) => version.version === currentVersion)) {
        list.unshift({
          id: `current-${currentVersion}`,
          stackId,
          version: currentVersion,
          description: 'Versão atual',
          composeTemplate: fallbackTemplate ?? '',
          createdAt: fallbackUpdatedAt ?? new Date().toISOString(),
          createdBy: null,
        });
      }
      setVersions(list);
      const defaultVersion = currentVersion ?? list[0]?.version ?? '';
      setSelectedVersion((prev) => prev || defaultVersion);
    } catch (err) {
      void err;
      setVersionsError('Falha ao carregar versões da stack.');
      setVersions([]);
      setSelectedVersion('');
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
      setVersions([]);
      setSelectedVersion('');
      setSelectedVariableIds([]);
      return;
    }
    void loadVariables(selectedStack.id);
    void loadVersions(
      selectedStack.id,
      selectedStack.currentVersion ?? null,
      selectedStack.composeTemplate,
      selectedStack.updatedAt,
    );
  }, [selectedStack?.id]);

  useEffect(() => {
    setSelectedVariableIds((prev) =>
      prev.filter((id) => versionFilteredVariables.some((variable) => variable.id === id)),
    );
  }, [versionFilteredVariables]);

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
      setToastMessage('Variável salva com sucesso.');
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

  const toggleVariableSelection = (id: string) => {
    setSelectedVariableIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedVariableIds([]);
      return;
    }
    setSelectedVariableIds(versionFilteredVariables.map((variable) => variable.id));
  };

  const handleDeleteSelectedVariables = async () => {
    if (!selectedStack || selectedVariableIds.length === 0) {
      return;
    }
    if (!window.confirm(`Remover ${selectedVariableIds.length} variáveis selecionadas?`)) {
      return;
    }
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      await deleteStackLocalVariablesBulk(selectedStack.id, selectedVariableIds);
      setSelectedVariableIds([]);
      await loadVariables(selectedStack.id);
      setToastMessage('Variáveis removidas com sucesso.');
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao remover variáveis.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const handleSaveInstanceVariable = async (variable: InstanceVariableRow) => {
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
      setToastMessage('Variável da instância salva com sucesso.');
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

  const handleClearInstanceVariable = async (variable: InstanceVariableRow) => {
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

  const handleSaveAllInstanceVariables = async () => {
    if (!selectedStack || !selectedInstanceId) {
      return;
    }
    const missingRequired = versionCompatibleVariables.filter(
      (variable) =>
        variable.isRequired &&
        !instanceVarDrafts[variable.variableName]?.trim() &&
        !variable.defaultValue?.trim(),
    );
    if (missingRequired.length > 0) {
      setVariablesError(
        `Preencha as variáveis obrigatórias: ${missingRequired.map((variable) => variable.variableName).join(', ')}`,
      );
      return;
    }

    setBulkSaving(true);
    setVariablesError(null);
    try {
      const updates = versionCompatibleVariables
        .map((variable) => ({
          variableName: variable.variableName,
          value: instanceVarDrafts[variable.variableName]?.trim() ?? '',
        }))
        .filter((entry) => entry.value.length > 0);
      await Promise.all(
        updates.map((entry) =>
          upsertInstanceVariable(selectedStack.id, selectedInstanceId, entry.variableName, entry.value)
        )
      );
      await loadInstanceVariables(selectedStack.id, selectedInstanceId);
      setToastMessage('Variáveis da instância salvas com sucesso.');
    } catch (err) {
      const message =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setVariablesError(message ?? 'Falha ao salvar variáveis da instância.');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSelectInstance = (instanceId: string) => {
    if (!selectedStack) {
      setVariablesError('Selecione uma stack antes de escolher a instância.');
      return;
    }
    if (!selectedVersion) {
      setVariablesError('Selecione uma versão para editar variáveis da instância.');
      return;
    }
    setSelectedInstanceId(instanceId || null);
    if (instanceId) {
      setInstanceModalOpen(true);
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
          <div className="card-header">
            <h2>Variáveis declaradas</h2>
            <div className="table-tools">
              <input
                data-testid="stacks.variables.search.input"
                value={variablesSearch}
                onChange={(event) => setVariablesSearch(event.target.value)}
                placeholder="Buscar por nome ou descrição"
              />
              <select
                value={selectedVersion}
                onChange={(event) => setSelectedVersion(event.target.value)}
                disabled={!selectedStack || versions.length === 0}
              >
                {versions.length === 0 ? (
                  <option value="">Sem versões cadastradas</option>
                ) : (
                  versions.map((version) => (
                    <option key={version.version} value={version.version}>
                      {version.version}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="danger"
                disabled={selectedCount === 0 || variablesLoading}
                onClick={handleDeleteSelectedVariables}
              >
                Remover selecionadas {selectedCount > 0 ? `(${selectedCount})` : ''}
              </button>
              <select
                data-testid="stacks.variables.instance.select"
                value={selectedInstanceId ?? ''}
                onChange={(event) => handleSelectInstance(event.target.value)}
                onClick={() => {
                  if (selectedInstanceId) {
                    setInstanceModalOpen(true);
                  }
                }}
                disabled={!selectedStack || instances.length === 0}
              >
                <option value="">Ver variáveis por instância</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} ({instance.environment})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {versionsError && <div className="inline-alert">{versionsError}</div>}
          {variablesError && <div className="inline-alert">{variablesError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para gerenciar variáveis do template.</div>
          ) : variablesLoading ? (
            <div className="empty-state">Carregando...</div>
          ) : versionFilteredVariables.length === 0 ? (
            <div className="empty-state">Nenhuma variável compatível com esta versão.</div>
          ) : (
            <table data-testid="stacks.variables.table">
              <thead>
                <tr>
                  <th className="selection-cell">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  </th>
                  <th>Variável</th>
                  <th>Obrigatoria</th>
                  <th>Default</th>
                  <th>Atualizado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {versionFilteredVariables.map((variable) => (
                  <tr key={variable.id}>
                    <td className="selection-cell">
                      <input
                        type="checkbox"
                        checked={selectedVariableIds.includes(variable.id)}
                        onChange={() => toggleVariableSelection(variable.id)}
                        aria-label={`Selecionar ${variable.variableName}`}
                      />
                    </td>
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
                          className="secondary"
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
      </div>

      <Modal
        isOpen={instanceModalOpen}
        title="Variáveis por instância"
        onClose={() => setInstanceModalOpen(false)}
        className="modal-wide"
      >
        <div className="card-header">
          <div className="table-tools">
            <input
              data-testid="stacks.variables.instance.search.input"
              value={instanceSearch}
              onChange={(event) => setInstanceSearch(event.target.value)}
              placeholder="Buscar por nome ou descrição"
            />
          </div>
        </div>
        {instancesError && <div className="inline-alert">{instancesError}</div>}
        {variablesError && <div className="inline-alert">{variablesError}</div>}
        {!selectedStack ? (
          <div className="empty-state">Selecione uma stack para editar variáveis da instância.</div>
        ) : !selectedVersion ? (
          <div className="empty-state">Selecione uma versão para visualizar variáveis.</div>
        ) : instances.length === 0 ? (
          <div className="empty-state">Nenhuma instância cadastrada.</div>
        ) : !selectedInstanceId ? (
          <div className="empty-state">Escolha uma instância para visualizar variáveis.</div>
        ) : variablesLoading ? (
          <div className="empty-state">Carregando...</div>
        ) : filteredInstanceVariables.length === 0 ? (
          <div className="empty-state">Cadastre variáveis para editar sobrescritas.</div>
        ) : (
          <div className="instance-variables-table-wrapper">
            <table className="table instance-variables-table" data-testid="stacks.variables.instance.table">
              <thead>
                <tr>
                  <th>Variável</th>
                  <th>Obrigatoria</th>
                  <th>Default</th>
                  <th>Valor na instância</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstanceVariables.map((variable) => {
                  const instanceValue = instanceVarDrafts[variable.variableName] ?? '';
                  const instanceEntry = instanceVariableMap.get(variable.variableName);
                  const statusLabel = !variable.isDeclared
                    ? 'Orfã'
                    : instanceEntry
                      ? 'Override'
                      : variable.defaultValue
                        ? 'Default'
                        : variable.isRequired
                          ? 'Pendente'
                          : 'Opcional';
                  const statusClass = !variable.isDeclared ? 'pill-warning' : `pill-${statusLabel.toLowerCase()}`;
                  return (
                    <tr key={variable.variableName}>
                      <td>
                        <div className="stack-name">{variable.variableName}</div>
                        <div className="stack-description small-text">
                          {variable.description ?? 'Sem descrição'}
                          {!variable.isDeclared && ' (não declarada)'}
                        </div>
                      </td>
                      <td>{variable.isRequired ? 'Sim' : 'Não'}</td>
                      <td>
                        <span className="cell-text" title={variable.defaultValue ?? 'n/a'}>
                          {variable.defaultValue ?? 'n/a'}
                        </span>
                      </td>
                      <td>
                        <input
                          value={instanceValue}
                          onChange={(event) =>
                            setInstanceVarDrafts((prev) => ({
                              ...prev,
                              [variable.variableName]: event.target.value,
                            }))
                          }
                          title={instanceValue || variable.defaultValue || ''}
                          placeholder={variable.defaultValue ?? ''}
                        />
                        {instanceEntry && (
                          <div className="stack-description small-text">
                            Atualizado em {formatDate(instanceEntry.updatedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${statusClass}`}>{statusLabel}</span>
                      </td>
                      <td>
                        <div className="actions inline-actions">
                          <button
                            type="button"
                            onClick={() => handleSaveInstanceVariable(variable)}
                            disabled={variablesLoading || bulkSaving}
                            className="primary"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleClearInstanceVariable(variable)}
                            disabled={variablesLoading || bulkSaving}
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
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={handleSaveAllInstanceVariables} disabled={variablesLoading || bulkSaving}>
            {bulkSaving ? 'Salvando...' : 'Salvar tudo'}
          </button>
          <button type="button" className="secondary" onClick={() => setInstanceModalOpen(false)}>
            Fechar
          </button>
        </div>
      </Modal>

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
      {toastMessage && (
        <div className="toast" role="status" onAnimationEnd={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </AppLayout>
  );
}
