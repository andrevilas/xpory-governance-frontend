import { useEffect, useMemo, useState } from 'react';
import yaml from 'js-yaml';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { fetchInventoryStacks, InventoryStack } from '../../services/inventory';
import {
  createInstance,
  deleteInstance,
  fetchInstances,
  PortainerInstance,
  updateInstance,
} from '../../services/instances';
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
  createStackLocalVariable,
  fetchStackInstanceVariables,
  fetchStackLocalVariables,
  fetchStacksLocal,
  StackInstanceVariable,
  StackLocal,
  StackLocalVariable,
  deployStackLocal,
  updateStackLocal,
  upsertInstanceVariable,
  deleteInstanceVariable,
} from '../../services/stacksLocal';
import { fetchInstanceStackCompose, fetchInstanceStacks, PortainerStack } from '../../services/portainer';
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
  const [stacksTab, setStacksTab] = useState<'remote' | 'global'>('remote');
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [instanceStacks, setInstanceStacks] = useState<PortainerStack[]>([]);
  const [selectedRemoteStackId, setSelectedRemoteStackId] = useState<number | null>(null);
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [stackVariables, setStackVariables] = useState<StackLocalVariable[]>([]);
  const [instanceVariables, setInstanceVariables] = useState<StackInstanceVariable[]>([]);
  const [stackVarDrafts, setStackVarDrafts] = useState<Record<string, string>>({});
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksError, setStacksError] = useState<string | null>(null);
  const [createStackOpen, setCreateStackOpen] = useState(false);
  const [newStackName, setNewStackName] = useState('');
  const [newStackDescription, setNewStackDescription] = useState('');
  const [newStackCompose, setNewStackCompose] = useState('');
  const [creatingStack, setCreatingStack] = useState(false);
  const [createStackError, setCreateStackError] = useState<string | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappingSuccess, setMappingSuccess] = useState<string | null>(null);
  const [confirmVariablesOpen, setConfirmVariablesOpen] = useState(false);
  const [confirmDeployOpen, setConfirmDeployOpen] = useState(false);
  const [confirmDeployText, setConfirmDeployText] = useState('');
  const [deployAfterSave, setDeployAfterSave] = useState(false);
  const [deployingStack, setDeployingStack] = useState(false);
  const [inventoryStacks, setInventoryStacks] = useState<InventoryStack[]>([]);
  const [registryImages, setRegistryImages] = useState<RegistryImageState[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryRunLoading, setRegistryRunLoading] = useState(false);
  const [registryUpdateDryRun, setRegistryUpdateDryRun] = useState(true);
  const [registryUpdateLoading, setRegistryUpdateLoading] = useState(false);
  const [registryUpdateResult, setRegistryUpdateResult] = useState<RegistryUpdateResult | null>(null);
  const [registryRuns, setRegistryRuns] = useState<RegistryRun[]>([]);

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

  const editingInstance = useMemo(
    () => instances.find((instance) => instance.id === editingId) ?? null,
    [instances, editingId],
  );

  const selectedStack = useMemo(
    () => stacks.find((stack) => stack.id === selectedStackId) ?? null,
    [stacks, selectedStackId],
  );

  const selectedRemoteStack = useMemo(
    () => instanceStacks.find((stack) => stack.id === selectedRemoteStackId) ?? null,
    [instanceStacks, selectedRemoteStackId],
  );

  const selectedRemoteForGlobal = useMemo(() => {
    if (!selectedStack) {
      return null;
    }
    return (
      instanceStacks.find((stack) => stack.name.toLowerCase() === selectedStack.name.toLowerCase()) ?? null
    );
  }, [instanceStacks, selectedStack]);

  const matchedInventoryStack = useMemo(() => {
    if (!selectedInstance || !selectedRemoteStack) {
      return null;
    }
    const byId = inventoryStacks.find(
      (stack) =>
        stack.instanceId === selectedInstance.id &&
        stack.portainerStackId === selectedRemoteStack.id &&
        stack.endpointId === selectedRemoteStack.endpointId,
    );
    if (byId) {
      return byId;
    }
    return (
      inventoryStacks.find(
        (stack) =>
          stack.instanceId === selectedInstance.id &&
          stack.name.toLowerCase() === selectedRemoteStack.name.toLowerCase(),
      ) ?? null
    );
  }, [inventoryStacks, selectedInstance, selectedRemoteStack]);

  const remoteStackNames = useMemo(() => {
    const set = new Set<string>();
    instanceStacks.forEach((stack) => set.add(stack.name.toLowerCase()));
    return set;
  }, [instanceStacks]);

  const stackNameConflict = useMemo(() => {
    const normalized = newStackName.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return stacks.some((stack) => stack.name.toLowerCase() === normalized);
  }, [newStackName, stacks]);

  const instanceVariableMap = useMemo(() => {
    const map = new Map<string, StackInstanceVariable>();
    instanceVariables.forEach((entry) => map.set(entry.variableName, entry));
    return map;
  }, [instanceVariables]);

  const hasVariableChanges = useMemo(() => {
    if (!selectedStackId) {
      return false;
    }
    return stackVariables.some((variable) => {
      const draft = (stackVarDrafts[variable.variableName] ?? '').trim();
      const current = (instanceVariableMap.get(variable.variableName)?.value ?? '').trim();
      return draft !== current;
    });
  }, [instanceVariableMap, selectedStackId, stackVarDrafts, stackVariables]);

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

  useEffect(() => {
    const loadInventory = async () => {
      if (!selectedInstance) {
        setInventoryStacks([]);
        return;
      }
      try {
        const result = await fetchInventoryStacks();
        setInventoryStacks(result.filter((stack) => stack.instanceId === selectedInstance.id));
      } catch (err) {
        void err;
        setInventoryStacks([]);
      }
    };

    void loadInventory();
  }, [selectedInstance]);

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
    const loadRegistry = async () => {
      if (!matchedInventoryStack) {
        setRegistryImages([]);
        setRegistryError(null);
        setRegistryUpdateResult(null);
        return;
      }
      setRegistryLoading(true);
      setRegistryError(null);
      try {
        const result = await fetchStackRegistryImages(matchedInventoryStack.id);
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
  }, [matchedInventoryStack]);

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
      if (matchedInventoryStack) {
        const refreshed = await fetchStackRegistryImages(matchedInventoryStack.id);
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
    if (!matchedInventoryStack) {
      return;
    }
    setRegistryUpdateLoading(true);
    setRegistryError(null);
    setRegistryUpdateResult(null);
    try {
      const result = await updateRegistryStack(matchedInventoryStack.id, { dryRun: registryUpdateDryRun });
      setRegistryUpdateResult(result);
      const refreshed = await fetchStackRegistryImages(matchedInventoryStack.id);
      setRegistryImages(refreshed);
    } catch (err) {
      void err;
      setRegistryError('Falha ao executar update por digest.');
    } finally {
      setRegistryUpdateLoading(false);
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
    setCreateStackError(null);
    setMappingError(null);
    setMappingSuccess(null);
    setStacksLoading(true);
    setIsStacksModalOpen(true);
    try {
      const [stacksResult, instanceStacksResult] = await Promise.all([
        fetchStacksLocal(),
        fetchInstanceStacks(instance.id),
      ]);
      setStacks(stacksResult);
      setInstanceStacks(instanceStacksResult);
      setSelectedStackId((prev) => prev ?? stacksResult[0]?.id ?? null);
      setSelectedRemoteStackId((prev) => prev ?? instanceStacksResult[0]?.id ?? null);
    } catch (err) {
      void err;
      setStacksError('Não foi possível carregar stacks globais.');
    } finally {
      setStacksLoading(false);
    }
  };

  const closeStacksModal = () => {
    setIsStacksModalOpen(false);
    setStacksTab('remote');
    setStacks([]);
    setInstanceStacks([]);
    setSelectedRemoteStackId(null);
    setSelectedStackId(null);
    setStackVariables([]);
    setInstanceVariables([]);
    setStackVarDrafts({});
    setStacksError(null);
    setCreateStackOpen(false);
    setNewStackName('');
    setNewStackDescription('');
    setNewStackCompose('');
    setCreateStackError(null);
    setMappingError(null);
    setMappingSuccess(null);
    setConfirmVariablesOpen(false);
    setConfirmDeployOpen(false);
    setConfirmDeployText('');
    setDeployAfterSave(false);
    setDeployingStack(false);
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

  const handleDeployStack = async () => {
    if (!selectedStackId || !selectedId) {
      return;
    }
    setStacksError(null);
    setMappingError(null);
    setDeployingStack(true);
    try {
      const result = await deployStackLocal(selectedStackId, { instanceIds: [selectedId], dryRun: false });
      const failure = result.find((item) => item.status === 'failed');
      if (failure) {
        setStacksError(failure.message || 'Falha ao realizar deploy.');
        return;
      }
      setMappingSuccess('Deploy executado com sucesso.');
    } catch (err) {
      void err;
      setStacksError('Falha ao realizar deploy.');
    } finally {
      setDeployingStack(false);
    }
  };

  const openCreateStackForm = async (fromRemote: boolean) => {
    setCreateStackError(null);
    setCreateStackOpen(true);
    setNewStackDescription('');
    setMappingError(null);
    setMappingSuccess(null);
    if (fromRemote && selectedRemoteStack && selectedInstance) {
      try {
        const compose = await fetchInstanceStackCompose(
          selectedInstance.id,
          selectedRemoteStack.id,
          selectedRemoteStack.endpointId,
        );
        setNewStackName(selectedRemoteStack.name);
        setNewStackCompose(compose);
      } catch (err) {
        void err;
        setCreateStackError('Falha ao carregar compose da stack remota.');
      }
      return;
    }
    setNewStackName('');
    setNewStackCompose('');
  };

  const extractPlaceholders = (compose: string): string[] => {
    const matches = compose.match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g) ?? [];
    const names = matches.map((match) => match.replace(/\{\{\s*|\s*\}\}/g, ''));
    return Array.from(new Set(names));
  };

  const parseComposeEnvironment = (compose: string): Record<string, string> => {
    try {
      const parsed = yaml.load(compose);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      const services = (parsed as { services?: Record<string, unknown> }).services;
      if (!services || typeof services !== 'object') {
        return {};
      }
      const result: Record<string, string> = {};
      Object.values(services).forEach((service) => {
        if (!service || typeof service !== 'object') {
          return;
        }
        const env = (service as { environment?: unknown }).environment;
        if (Array.isArray(env)) {
          env.forEach((entry) => {
            if (typeof entry === 'string') {
              const idx = entry.indexOf('=');
              if (idx === -1) {
                result[entry] = result[entry] ?? '';
                return;
              }
              const key = entry.slice(0, idx).trim();
              const value = entry.slice(idx + 1);
              result[key] = value;
              return;
            }
            if (entry && typeof entry === 'object') {
              Object.entries(entry as Record<string, unknown>).forEach(([key, value]) => {
                result[key] = value === null || value === undefined ? '' : String(value);
              });
            }
          });
          return;
        }
        if (env && typeof env === 'object') {
          Object.entries(env as Record<string, unknown>).forEach(([key, value]) => {
            result[key] = value === null || value === undefined ? '' : String(value);
          });
        }
      });
      return result;
    } catch (err) {
      void err;
      return {};
    }
  };

  const importVariablesForStack = async (
    stackId: string,
    compose: string,
    instanceId?: string,
  ): Promise<{ created: number; skipped: number; valuesApplied: number }> => {
    const placeholders = extractPlaceholders(compose);
    const envValues = parseComposeEnvironment(compose);
    const names = Array.from(new Set([...placeholders, ...Object.keys(envValues)]));
    if (names.length === 0) {
      return { created: 0, skipped: 0, valuesApplied: 0 };
    }
    const existing = await fetchStackLocalVariables(stackId);
    const existingNames = new Set(existing.map((variable) => variable.variableName));
    const missing = names.filter((name) => !existingNames.has(name));
    if (missing.length > 0) {
      await Promise.all(
        missing.map((variableName) =>
          createStackLocalVariable(stackId, {
            variableName,
            description: 'Importado da stack remota',
            isRequired: false,
          }),
        ),
      );
    }
    let valuesApplied = 0;
    if (instanceId) {
      await Promise.all(
        Object.entries(envValues).map(async ([variableName, value]) => {
          if (value === '') {
            return;
          }
          await upsertInstanceVariable(stackId, instanceId, variableName, value);
          valuesApplied += 1;
        }),
      );
    }
    return { created: missing.length, skipped: names.length - missing.length, valuesApplied };
  };

  const handleCreateStack = async () => {
    setCreateStackError(null);
    if (!newStackName.trim() || !newStackCompose.trim()) {
      setCreateStackError('Informe nome e compose para criar a stack global.');
      return;
    }
    setCreatingStack(true);
    try {
      const created = await createStackLocal({
        name: newStackName.trim(),
        description: newStackDescription.trim() || undefined,
        composeTemplate: newStackCompose.trim(),
      });
      const importResult = await importVariablesForStack(
        created.id,
        newStackCompose.trim(),
        selectedInstance?.id,
      );
      const stacksResult = await fetchStacksLocal();
      setStacks(stacksResult);
      setSelectedStackId(created.id);
      setCreateStackOpen(false);
      setNewStackName('');
      setNewStackDescription('');
      setNewStackCompose('');
      setMappingSuccess(
        importResult.created > 0 || importResult.valuesApplied > 0
          ? `Stack criada. ${importResult.created} variáveis importadas, ${importResult.valuesApplied} valores aplicados.`
          : 'Stack criada sem variáveis detectadas.',
      );
    } catch (err) {
      void err;
      setCreateStackError('Falha ao criar stack global.');
    } finally {
      setCreatingStack(false);
    }
  };

  const handleMapRemoteToGlobal = async () => {
    if (!selectedRemoteStack || !selectedInstance || !selectedStackId) {
      return;
    }
    setMappingLoading(true);
    setMappingError(null);
    setMappingSuccess(null);
    try {
      const compose = await fetchInstanceStackCompose(
        selectedInstance.id,
        selectedRemoteStack.id,
        selectedRemoteStack.endpointId,
      );
      await updateStackLocal(selectedStackId, { composeTemplate: compose });
      const stacksResult = await fetchStacksLocal();
      setStacks(stacksResult);
      const importResult = await importVariablesForStack(selectedStackId, compose, selectedInstance.id);
      await loadStackVariables(selectedStackId, selectedInstance.id);
      setMappingSuccess(
        `Atualização concluída. ${importResult.created} variáveis importadas, ${importResult.valuesApplied} valores aplicados.`,
      );
    } catch (err) {
      void err;
      setMappingError('Falha ao atualizar stack global a partir da remota.');
    } finally {
      setMappingLoading(false);
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
        {editingInstance && (
          <div className="modal-summary">
            <div>
              <div className="modal-summary-title">{editingInstance.name}</div>
              <div className="modal-summary-subtitle">{editingInstance.environment}</div>
            </div>
            <span className="pill">{editingInstance.baseUrl}</span>
          </div>
        )}
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
        title={`Stacks · ${selectedInstance ? selectedInstance.name : 'Instância'}`}
        onClose={closeStacksModal}
        className="stacks-modal"
      >
        {stacksError && <div className="inline-alert">{stacksError}</div>}
        {mappingError && <div className="inline-alert">{mappingError}</div>}
        {mappingSuccess && <div className="inline-warning">{mappingSuccess}</div>}
        {stacksLoading ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <>
            <div className="stacks-modal-tabs">
              <button
                type="button"
                className={stacksTab === 'remote' ? 'active' : ''}
                onClick={() => setStacksTab('remote')}
              >
                Stacks remotas
              </button>
              <button
                type="button"
                className={stacksTab === 'global' ? 'active' : ''}
                onClick={() => setStacksTab('global')}
              >
                Stacks globais
              </button>
            </div>

            {stacksTab === 'remote' ? (
              <div className="stacks-tab-content">
                <div className="stack-panel">
                  <h3>Seleção remota</h3>
                  <div className="form-grid">
                    <label>
                      Stack remota
                      <select
                        value={selectedRemoteStackId ?? ''}
                        onChange={(event) => setSelectedRemoteStackId(Number(event.target.value) || null)}
                        disabled={instanceStacks.length === 0}
                      >
                        {instanceStacks.length === 0 ? (
                          <option value="">Nenhuma stack remota encontrada</option>
                        ) : (
                          instanceStacks.map((stack) => (
                            <option key={stack.id} value={stack.id}>
                              {stack.name} (endpoint {stack.endpointId})
                            </option>
                          ))
                      )}
                    </select>
                  </label>
                </div>
                </div>

                <div className="stack-panel">
                  <h3>Mapear para stack global</h3>
                  <div className="form-grid">
                    <label>
                      Stack global alvo
                      <select
                        value={selectedStackId ?? ''}
                        onChange={(event) => setSelectedStackId(event.target.value || null)}
                        disabled={stacks.length === 0}
                      >
                        {stacks.length === 0 ? (
                          <option value="">Nenhuma stack global cadastrada</option>
                        ) : (
                          stacks.map((stack) => {
                            const isRemote = remoteStackNames.has(stack.name.toLowerCase());
                            return (
                              <option key={stack.id} value={stack.id}>
                                {stack.name} {isRemote ? '(remota)' : '(sem stack remota)'}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </label>
                  </div>
                  <div className="stack-actions">
                    <button
                      type="button"
                      onClick={() => void handleMapRemoteToGlobal()}
                      disabled={!selectedRemoteStack || !selectedStackId || mappingLoading}
                    >
                      {mappingLoading ? 'Atualizando...' : 'Atualizar compose e importar variáveis'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void openCreateStackForm(true)}
                      disabled={!selectedRemoteStack}
                    >
                      Criar global a partir da remota
                    </button>
                  </div>
                </div>

                <div className="registry-panel">
                  <h4>Digest da stack</h4>
                  <p className="helper-text">
                    Última execução do registry watcher:{' '}
                    {lastRegistryRun
                      ? `${formatDateTime(lastRegistryRun.createdAt)} · ${lastRegistryRun.status}`
                      : 'n/a'}
                  </p>
                  {!matchedInventoryStack ? (
                    <p className="helper-text">
                      Nenhuma stack encontrada no inventário para esta instância.
                    </p>
                  ) : (
                    <>
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
              </div>
            ) : (
              <div className="stacks-tab-content">
                <div className="stack-panel">
                  <h3>Stacks globais</h3>
                  <div className="form-grid">
                    <label>
                      Stack global
                      <select
                        value={selectedStackId ?? ''}
                        onChange={(event) => setSelectedStackId(event.target.value || null)}
                        disabled={stacks.length === 0}
                      >
                        {stacks.length === 0 ? (
                          <option value="">Nenhuma stack global cadastrada</option>
                        ) : (
                          stacks.map((stack) => {
                            const isRemote = remoteStackNames.has(stack.name.toLowerCase());
                            return (
                              <option key={stack.id} value={stack.id}>
                                {stack.name} {isRemote ? '(remota)' : '(sem stack remota)'}
                              </option>
                            );
                          })
                        )}
                      </select>
                    </label>
                  </div>
                  {!selectedRemoteForGlobal && selectedStackId ? (
                    <div className="stack-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeployText('');
                          setConfirmDeployOpen(true);
                        }}
                        disabled={deployingStack}
                      >
                        {deployingStack ? 'Executando...' : 'Fazer deploy nesta instância'}
                      </button>
                    </div>
                  ) : null}
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
                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setConfirmVariablesOpen(true)}
                    disabled={stacksLoading || !selectedStack || !hasVariableChanges}
                  >
                    Salvar variáveis
                  </button>
                  <button type="button" className="secondary" onClick={closeStacksModal}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        isOpen={createStackOpen}
        title="Nova stack global"
        onClose={() => setCreateStackOpen(false)}
      >
        {createStackError && <div className="inline-alert">{createStackError}</div>}
        {stackNameConflict && (
          <div className="inline-warning">
            Já existe uma stack global com este nome. Uma nova stack será criada mesmo assim.
          </div>
        )}
        <div className="form-grid">
          <label>
            Nome
            <input value={newStackName} onChange={(event) => setNewStackName(event.target.value)} />
          </label>
          <label>
            Descrição
            <input
              value={newStackDescription}
              onChange={(event) => setNewStackDescription(event.target.value)}
            />
          </label>
        </div>
        <label className="full-width">
          Compose template
          <textarea
            value={newStackCompose}
            onChange={(event) => setNewStackCompose(event.target.value)}
            rows={10}
          />
        </label>
        <div className="form-actions">
          <button type="button" onClick={handleCreateStack} disabled={creatingStack}>
            Criar stack global
          </button>
          <button type="button" className="secondary" onClick={() => setCreateStackOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmVariablesOpen}
        title="Atualizar variáveis da instância"
        onClose={() => setConfirmVariablesOpen(false)}
      >
        <p className="helper-text">
          Deseja aplicar as variáveis informadas para esta instância? Isso substituirá os valores atuais.
        </p>
        {selectedRemoteForGlobal ? (
          <label className="checkbox-toggle">
            <input
              type="checkbox"
              checked={deployAfterSave}
              onChange={(event) => setDeployAfterSave(event.target.checked)}
            />
            Executar deploy após salvar as variáveis
          </label>
        ) : (
          <p className="helper-text">A stack global ainda não está presente remotamente.</p>
        )}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              setConfirmVariablesOpen(false);
              void handleSaveStackVariables();
              if (deployAfterSave) {
                void handleDeployStack();
              }
            }}
          >
            Confirmar
          </button>
          <button type="button" className="secondary" onClick={() => setConfirmVariablesOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmDeployOpen}
        title="Confirmar deploy"
        onClose={() => setConfirmDeployOpen(false)}
      >
        <p className="helper-text">
          Para confirmar o deploy desta stack, digite <strong>deploy</strong>.
        </p>
        <input
          value={confirmDeployText}
          onChange={(event) => setConfirmDeployText(event.target.value)}
          placeholder="digite deploy"
        />
        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              setConfirmDeployOpen(false);
              void handleDeployStack();
            }}
            disabled={confirmDeployText.trim().toLowerCase() !== 'deploy'}
          >
            Confirmar deploy
          </button>
          <button type="button" className="secondary" onClick={() => setConfirmDeployOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
