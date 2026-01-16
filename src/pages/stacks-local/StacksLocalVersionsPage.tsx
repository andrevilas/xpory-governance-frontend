import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '../../components/layout/AppLayout';
import { Modal } from '../../components/ui/Modal';
import { PageTabs } from '../../components/ui/PageTabs';
import {
  createStackLocalVersion,
  fetchStackLocalVersions,
  fetchStacksLocal,
  StackLocal,
  StackLocalVersion,
} from '../../services/stacksLocal';
import './stacks-local.css';

type VersionFormState = {
  version: string;
  description: string;
  createdBy: string;
};

const emptyVersionForm: VersionFormState = {
  version: '',
  description: '',
  createdBy: '',
};

const tabs = [
  { label: 'Stacks', path: '/app/stacks' },
  { label: 'Variáveis', path: '/app/stacks/variables' },
  { label: 'Versões', path: '/app/stacks/versions' },
];

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');

export function StacksLocalVersionsPage(): JSX.Element {
  const navigate = useNavigate();
  const [stacks, setStacks] = useState<StackLocal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<StackLocalVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionForm, setVersionForm] = useState<VersionFormState>(emptyVersionForm);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    void loadStacks();
  }, []);

  useEffect(() => {
    if (!selectedStack) {
      setVersions([]);
      return;
    }
    void loadVersions(selectedStack.id);
  }, [selectedStack?.id]);

  const openModal = () => {
    setVersionForm(emptyVersionForm);
    setVersionsError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setVersionForm(emptyVersionForm);
    setVersionsError(null);
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
      await loadVersions(selectedStack.id);
      closeModal();
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

  const handleLoadVersion = (version: StackLocalVersion) => {
    if (!selectedStack) {
      return;
    }
    const draft = {
      stackId: selectedStack.id,
      versionId: version.id,
      version: version.version,
      composeTemplate: version.composeTemplate,
    };
    localStorage.setItem('stacksLocal:editorDraft', JSON.stringify(draft));
    navigate('/app/stacks');
  };

  return (
    <AppLayout
      title="Stacks / Versões"
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
          <h2>Versões e histórico</h2>
          {versionsError && <div className="inline-alert">{versionsError}</div>}
          {!selectedStack ? (
            <div className="empty-state">Selecione uma stack para gerenciar versões.</div>
          ) : versionsLoading ? (
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
                          <button type="button" onClick={() => handleLoadVersion(version)}>
                            Carregar no editor
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

      <Modal isOpen={isModalOpen} title="Nova versão" onClose={closeModal}>
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
            {versionsLoading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="secondary" onClick={closeModal}>
            Cancelar
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
