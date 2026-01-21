import { useEffect, useMemo, useState } from 'react';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import { fetchInstances, PortainerInstance } from '../../services/instances';
import {
  fetchRegistryRuns,
  fetchStackRegistryImages,
  runRegistry,
  updateRegistryStack,
  RegistryImageState,
  RegistryRun,
  RegistryUpdateResult,
} from '../../services/registry';
import {
  createStackLocal,
  createStackLocalVersion,
  createStackLocalVariable,
  deleteStackLocal,
  deployStackLocal,
  DeployStackLocalResult,
  fetchStackLocalPreview,
  fetchStackLocalVariables,
  fetchStackLocalVersions,
  fetchStacksLocal,
  StackLocal,
  StackLocalPreview,
  StackLocalVersion,
  updateStackLocal,
} from '../../services/stacksLocal';
import './stacks-local.css';

type StackFormState = {
  name: string;
  description: string;
  composeTemplate: string;
  currentVersion: string;
};

const emptyForm: StackFormState = {
  name: '',
  description: '',
  composeTemplate: '',
  currentVersion: '',
};

const tabs = [
  { label: 'Stacks', path: '/app/stacks' },
  { label: 'Variáveis', path: '/app/stacks/variables' },
  { label: 'Versões', path: '/app/stacks/versions' },
];

type EditorDraft = {
  stackId: string;
  versionId?: string;
  version?: string;
  composeTemplate?: string;
};

const EDITOR_DRAFT_KEY = 'stacksLocal:editorDraft';
const TEMPLATE_VARIABLE_PATTERN = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

const extractTemplateVariables = (template: string): string[] => {
  const matches = new Set<string>();
  if (!template) {
    return [];
  }
  let match = TEMPLATE_VARIABLE_PATTERN.exec(template);
  while (match) {
    matches.add(match[1]);
    match = TEMPLATE_VARIABLE_PATTERN.exec(template);
  }
  return Array.from(matches).sort((a, b) => a.localeCompare(b));
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [instances, setInstances] = useState<PortainerInstance[]>([]);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [versions, setVersions] = useState<StackLocalVersion[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [deploySelection, setDeploySelection] = useState<string[]>([]);
  const [deployDryRun, setDeployDryRun] = useState(true);
  const [deployUserId, setDeployUserId] = useState('');
  const [deployTargetVersion, setDeployTargetVersion] = useState('');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<StackLocalPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deployResults, setDeployResults] = useState<DeployStackLocalResult[]>([]);
  const [deployLoading, setDeployLoading] = useState(false);
  const [pendingVariables, setPendingVariables] = useState<string[]>([]);
  const [autoVariablesMessage, setAutoVariablesMessage] = useState<string | null>(null);
  const [autoVariablesError, setAutoVariablesError] = useState<string | null>(null);
  const [originalStack, setOriginalStack] = useState<StackLocal | null>(null);
  const [isVersionPromptOpen, setIsVersionPromptOpen] = useState(false);
  const [versionPromptValue, setVersionPromptValue] = useState('');
  const [versionPromptError, setVersionPromptError] = useState<string | null>(null);
  const [pendingVersionSave, setPendingVersionSave] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'details' | 'deploy'>('details');
  const [inventoryStacks, setInventoryStacks] = useState<InventoryStack[]>([]);
  const [selectedInventoryStackId, setSelectedInventoryStackId] = useState<string | null>(null);
  const [registryImages, setRegistryImages] = useState<RegistryImageState[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryRunLoading, setRegistryRunLoading] = useState(false);
  const [registryUpdateDryRun, setRegistryUpdateDryRun] = useState(true);
  const [registryUpdateLoading, setRegistryUpdateLoading] = useState(false);
  const [registryUpdateResult, setRegistryUpdateResult] = useState<RegistryUpdateResult | null>(null);
  const [registryRuns, setRegistryRuns] = useState<RegistryRun[]>([]);

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

  const matchingInventoryStacks = useMemo(() => {
    if (!selectedStack) {
      return [];
    }
    const name = selectedStack.name.toLowerCase();
    return inventoryStacks.filter(
      (stack) => !stack.removedAt && stack.name.toLowerCase() === name,
    );
  }, [inventoryStacks, selectedStack]);

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
    } catch (err) {
      void err;
      setInstancesError('Não foi possível carregar instâncias.');
    }
  };

  const loadVersions = async (stackId: string) => {
    setVersionsError(null);
    try {
      const result = await fetchStackLocalVersions(stackId);
      setVersions(result);
    } catch (err) {
      void err;
      setVersionsError('Falha ao carregar histórico de versões.');
    }
  };

  useEffect(() => {
    void loadStacks();
    void loadInstances();
  }, []);

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const result = await fetchInventoryStacks();
        setInventoryStacks(result);
      } catch (err) {
        void err;
        setInventoryStacks([]);
      }
    };

    void loadInventory();
  }, []);

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

  useEffect(() => {
    if (matchingInventoryStacks.length === 0) {
      setSelectedInventoryStackId(null);
      return;
    }
    setSelectedInventoryStackId((prev) => prev ?? matchingInventoryStacks[0]?.id ?? null);
  }, [matchingInventoryStacks]);

  useEffect(() => {
    const loadRegistry = async () => {
      if (!selectedInventoryStackId) {
        setRegistryImages([]);
        setRegistryError(null);
        setRegistryUpdateResult(null);
        return;
      }
      setRegistryLoading(true);
      setRegistryError(null);
      try {
        const result = await fetchStackRegistryImages(selectedInventoryStackId);
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
  }, [selectedInventoryStackId]);

  useEffect(() => {
    if (loading || stacks.length === 0) {
      return;
    }
    const rawDraft = localStorage.getItem(EDITOR_DRAFT_KEY);
    if (!rawDraft) {
      return;
    }
    let draft: EditorDraft | null = null;
    try {
      draft = JSON.parse(rawDraft) as EditorDraft;
    } catch (err) {
      void err;
      localStorage.removeItem(EDITOR_DRAFT_KEY);
      return;
    }
    if (!draft?.stackId) {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
      return;
    }
    const stack = stacks.find((item) => item.id === draft?.stackId);
    if (!stack) {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
      return;
    }
    setSelectedId(stack.id);
    setEditingId(stack.id);
    setForm({
      name: stack.name,
      description: stack.description ?? '',
      composeTemplate: draft.composeTemplate ?? stack.composeTemplate,
      currentVersion: draft.version ?? stack.currentVersion ?? '',
    });
    setOriginalStack(stack);
    setError(null);
    setIsModalOpen(true);
    localStorage.removeItem(EDITOR_DRAFT_KEY);
  }, [loading, stacks]);

  useEffect(() => {
    if (!selectedStack) {
    setVersions([]);
    setPreviewResults([]);
    setDeployResults([]);
    setDeployError(null);
    return;
  }
    void loadVersions(selectedStack.id);
    setDeployTargetVersion(selectedStack.currentVersion ?? '');
    setDeployError(null);
  }, [selectedStack?.id]);

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
    setOriginalStack(stack);
    setError(null);
    setPendingVariables([]);
    setAutoVariablesMessage(null);
    setAutoVariablesError(null);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOriginalStack(null);
    setError(null);
    setPendingVariables([]);
    setAutoVariablesMessage(null);
    setAutoVariablesError(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOriginalStack(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setError(null);
    setPendingVariables([]);
    setAutoVariablesMessage(null);
    setAutoVariablesError(null);
    setIsVersionPromptOpen(false);
    setPendingVersionSave(false);
    setVersionPromptValue('');
    setVersionPromptError(null);
  };

  const openDetails = (stack: StackLocal) => {
    setSelectedId(stack.id);
    setDetailsTab('details');
    setDeployError(null);
    setPreviewResults([]);
    setDeployResults([]);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setDeployError(null);
    setPreviewResults([]);
    setDeployResults([]);
  };

  const createTemplateVariables = async (stackId: string, variables: string[]) => {
    if (variables.length === 0) {
      return;
    }
    const existing = await fetchStackLocalVariables(stackId);
    const existingNames = new Set(existing.map((item) => item.variableName));
    const targets = variables.filter((name) => !existingNames.has(name));
    if (targets.length === 0) {
      setAutoVariablesMessage('Todas as variáveis já existem.');
      return;
    }
    await Promise.all(
      targets.map((variableName) =>
        createStackLocalVariable(stackId, {
          variableName,
          isRequired: true,
        }),
      ),
    );
    setAutoVariablesMessage(`Variáveis criadas: ${targets.length}.`);
  };

  const handleGenerateVariables = async () => {
    const variables = extractTemplateVariables(form.composeTemplate);
    setAutoVariablesError(null);
    setAutoVariablesMessage(null);
    if (variables.length === 0) {
      setAutoVariablesError('Nenhum placeholder encontrado no template.');
      return;
    }
    if (editingId) {
      try {
        await createTemplateVariables(editingId, variables);
      } catch (err) {
        void err;
        setAutoVariablesError('Falha ao criar variáveis automaticamente.');
      }
      return;
    }
    setPendingVariables(variables);
    setAutoVariablesMessage(`Variáveis detectadas: ${variables.length}. Serão criadas após salvar.`);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.composeTemplate.trim()) {
      setError('Preencha nome e template.');
      return;
    }
    const templateChanged =
      !!editingId && !!originalStack && form.composeTemplate.trim() !== originalStack.composeTemplate.trim();
    if (templateChanged && !pendingVersionSave) {
      setIsVersionPromptOpen(true);
      setVersionPromptError(null);
      setVersionPromptValue('');
      setPendingVersionSave(true);
      return;
    }
    setSaving(true);
    setError(null);
    setAutoVariablesError(null);
    setAutoVariablesMessage(null);
    try {
      let stackId = editingId;
      if (editingId) {
        const versionValue = templateChanged ? versionPromptValue.trim() : form.currentVersion.trim();
        if (templateChanged && !versionValue) {
          setVersionPromptError('Informe a nova versão.');
          setIsVersionPromptOpen(true);
          setSaving(false);
          return;
        }
        if (templateChanged) {
          await createStackLocalVersion(editingId, {
            version: versionValue,
            composeTemplate: form.composeTemplate.trim(),
          });
        }
        await updateStackLocal(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          composeTemplate: form.composeTemplate.trim(),
          currentVersion: versionValue || null,
        });
      } else {
        const created = await createStackLocal({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          composeTemplate: form.composeTemplate.trim(),
          currentVersion: form.currentVersion.trim() || undefined,
        });
        stackId = created.id;
      }
      if (stackId && pendingVariables.length > 0) {
        await createTemplateVariables(stackId, pendingVariables);
        setPendingVariables([]);
      }
      await loadStacks();
      resetForm();
      setIsModalOpen(false);
      setIsVersionPromptOpen(false);
      setPendingVersionSave(false);
      setVersionPromptValue('');
      setVersionPromptError(null);
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

  const confirmVersionPrompt = () => {
    if (!versionPromptValue.trim()) {
      setVersionPromptError('Informe a nova versão.');
      return;
    }
    setVersionPromptError(null);
    setForm((prev) => ({ ...prev, currentVersion: versionPromptValue.trim() }));
    setIsVersionPromptOpen(false);
    void handleSave();
  };

  const cancelVersionPrompt = () => {
    setIsVersionPromptOpen(false);
    setPendingVersionSave(false);
    setVersionPromptValue('');
    setVersionPromptError(null);
  };

  const handleDelete = async (stack: StackLocal) => {
    setSaving(true);
    setError(null);
    try {
      await deleteStackLocal(stack.id);
      await loadStacks();
      if (selectedId === stack.id) {
        setSelectedId(null);
        setIsDetailsOpen(false);
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

  const toggleDeployInstance = (instanceId: string) => {
    setDeploySelection((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  };

  const handlePreview = async () => {
    if (!selectedStack || deploySelection.length === 0) {
      setDeployError('Selecione instâncias para preview.');
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
      setDeployError('Falha ao gerar preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedStack || deploySelection.length === 0) {
      setDeployError('Selecione instâncias para deploy.');
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
      setDeployError('Falha ao executar deploy.');
    } finally {
      setDeployLoading(false);
    }
  };

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
    if (!selectedInventoryStackId) {
      return;
    }
    setRegistryRunLoading(true);
    setRegistryError(null);
    try {
      await runRegistry();
      const runs = await fetchRegistryRuns(10);
      setRegistryRuns(runs);
      const refreshed = await fetchStackRegistryImages(selectedInventoryStackId);
      setRegistryImages(refreshed);
    } catch (err) {
      void err;
      setRegistryError('Não foi possível atualizar o registry watcher.');
    } finally {
      setRegistryRunLoading(false);
    }
  };

  const handleRegistryUpdate = async () => {
    if (!selectedInventoryStackId) {
      return;
    }
    setRegistryUpdateLoading(true);
    setRegistryError(null);
    setRegistryUpdateResult(null);
    try {
      const result = await updateRegistryStack(selectedInventoryStackId, { dryRun: registryUpdateDryRun });
      setRegistryUpdateResult(result);
      const refreshed = await fetchStackRegistryImages(selectedInventoryStackId);
      setRegistryImages(refreshed);
    } catch (err) {
      void err;
      setRegistryError('Falha ao executar update por digest.');
    } finally {
      setRegistryUpdateLoading(false);
    }
  };

  return (
    <AppLayout
      title="Stacks / Globais"
      headerAction={
        <button type="button" className="header-button primary" onClick={openCreate}>
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
                  <th>Ações</th>
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
                        <button
                          type="button"
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetails(stack);
                          }}
                        >
                          Detalhes
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(stack);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(stack);
                          }}
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

      <Modal isOpen={isModalOpen} title={editingId ? 'Editar stack' : 'Nova stack'} onClose={closeModal}>
        {autoVariablesError && <div className="inline-alert">{autoVariablesError}</div>}
        {autoVariablesMessage && <div className="hint">{autoVariablesMessage}</div>}
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
          <button type="button" className="secondary" onClick={handleGenerateVariables} disabled={saving}>
            Gerar variáveis do template
          </button>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
          </button>
          <button type="button" className="secondary" onClick={closeModal}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isDetailsOpen}
        title={selectedStack ? `Detalhes: ${selectedStack.name}` : 'Detalhes da stack'}
        onClose={closeDetails}
      >
        {!selectedStack ? (
          <div className="empty-state">Selecione uma stack para visualizar detalhes.</div>
        ) : (
          <div className="stack-details-modal">
            <div className="stack-details-header">
              <div>
                <div className="stack-details-name">{selectedStack.name}</div>
                <div className="stack-details-subtitle">Stack selecionada</div>
              </div>
              <span className="pill">
                {selectedStack.currentVersion ?? 'n/a'}
              </span>
            </div>
            <div className="stack-details-tabs">
              <button
                type="button"
                className={`stack-details-tab${detailsTab === 'details' ? ' active' : ''}`}
                onClick={() => setDetailsTab('details')}
              >
                Detalhes
              </button>
              <button
                type="button"
                className={`stack-details-tab${detailsTab === 'deploy' ? ' active' : ''}`}
                onClick={() => setDetailsTab('deploy')}
              >
                Deploy & Preview
              </button>
            </div>

            {detailsTab === 'details' ? (
              <>
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
                <div className="registry-panel">
                  <strong>Digests por instância</strong>
                  <p className="helper-text">
                    Última execução do registry watcher:{' '}
                    {lastRegistryRun
                      ? `${formatDateTime(lastRegistryRun.createdAt)} · ${lastRegistryRun.status}`
                      : 'n/a'}
                  </p>
                  {matchingInventoryStacks.length === 0 ? (
                    <div className="empty-state">Nenhuma stack encontrada no inventário.</div>
                  ) : (
                    <>
                      <div className="registry-controls">
                        <label>
                          Instância
                          <select
                            value={selectedInventoryStackId ?? ''}
                            onChange={(event) => setSelectedInventoryStackId(event.target.value || null)}
                          >
                            {matchingInventoryStacks.map((stack) => (
                              <option key={stack.id} value={stack.id}>
                                {stack.instanceName ?? 'Instância'} (endpoint {stack.endpointId})
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="registry-actions">
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
                          <button type="button" onClick={handleRegistryUpdate} disabled={registryUpdateLoading}>
                            {registryUpdateLoading ? 'Executando...' : 'Atualizar por digest'}
                          </button>
                        </div>
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
                          <h5>Log do refresh de imagens</h5>
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
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {instancesError && <div className="inline-alert">{instancesError}</div>}
                {versionsError && <div className="inline-alert">{versionsError}</div>}
                {deployError && <div className="inline-alert">{deployError}</div>}
                {instances.length === 0 ? (
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
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isVersionPromptOpen} title="Nova versão obrigatória" onClose={cancelVersionPrompt}>
        {versionPromptError && <div className="inline-alert">{versionPromptError}</div>}
        <div className="form-grid">
          <label>
            Informe a nova versão
            <input
              value={versionPromptValue}
              onChange={(event) => setVersionPromptValue(event.target.value)}
              placeholder="1.2.1"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" onClick={confirmVersionPrompt} disabled={saving}>
            Confirmar
          </button>
          <button type="button" className="secondary" onClick={cancelVersionPrompt} disabled={saving}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
