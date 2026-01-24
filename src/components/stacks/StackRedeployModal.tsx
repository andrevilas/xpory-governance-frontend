import { useEffect, useMemo, useState } from 'react';

import {
  fetchStackInstanceVariables,
  fetchStackLocalPreview,
  fetchStackLocalVariables,
  redeployStackLocal,
  StackLocal,
  StackLocalVariable,
  upsertInstanceVariable,
} from '../../services/stacksLocal';
import { InventoryStack } from '../../services/inventory';
import { Modal } from '../ui/Modal';
import './stack-redeploy-modal.css';

type StackRedeployModalProps = {
  isOpen: boolean;
  stack: InventoryStack | null;
  localStacks: StackLocal[];
  onClose: () => void;
  onSuccess?: () => void;
};

type VariableDrafts = Record<string, string>;

type PreviewIssues = {
  missingVariables: string[];
  unknownVariables: string[];
};

const CONFIRM_WORD = 'redeploy';

export function StackRedeployModal({
  isOpen,
  stack,
  localStacks,
  onClose,
  onSuccess,
}: StackRedeployModalProps): JSX.Element {
  const [confirmValue, setConfirmValue] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [variablesLoading, setVariablesLoading] = useState(false);
  const [variablesSaving, setVariablesSaving] = useState(false);
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [stackVariables, setStackVariables] = useState<StackLocalVariable[]>([]);
  const [drafts, setDrafts] = useState<VariableDrafts>({});
  const [previewIssues, setPreviewIssues] = useState<PreviewIssues | null>(null);

  const localStack = useMemo(() => {
    if (!stack) {
      return null;
    }
    return localStacks.find((item) => item.name.toLowerCase() === stack.name.toLowerCase()) ?? null;
  }, [stack, localStacks]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmValue('');
      setConfirmError(null);
      setConfirmLoading(false);
      setVariablesOpen(false);
      setVariablesLoading(false);
      setVariablesSaving(false);
      setVariablesError(null);
      setStackVariables([]);
      setDrafts({});
      setPreviewIssues(null);
    }
  }, [isOpen]);

  const buildDrafts = (variables: StackLocalVariable[], values: Record<string, string>): VariableDrafts => {
    const nextDrafts: VariableDrafts = {};
    variables.forEach((variable) => {
      const instanceValue = values[variable.variableName];
      nextDrafts[variable.variableName] = instanceValue ?? variable.defaultValue ?? '';
    });
    return nextDrafts;
  };

  const loadVariables = async (stackId: string, instanceId: string) => {
    setVariablesLoading(true);
    setVariablesError(null);
    try {
      const [variables, values] = await Promise.all([
        fetchStackLocalVariables(stackId),
        fetchStackInstanceVariables(stackId, instanceId),
      ]);
      const valueMap: Record<string, string> = {};
      values.forEach((item) => {
        valueMap[item.variableName] = item.value;
      });
      setStackVariables(variables);
      setDrafts(buildDrafts(variables, valueMap));
    } catch (err) {
      void err;
      setVariablesError('Falha ao carregar variaveis da stack.');
    } finally {
      setVariablesLoading(false);
    }
  };

  const runPreview = async (stackId: string, instanceId: string) => {
    const preview = await fetchStackLocalPreview(stackId, instanceId);
    setPreviewIssues({
      missingVariables: preview.missingVariables,
      unknownVariables: preview.unknownVariables,
    });
    return preview;
  };

  const executeRedeploy = async (stackId: string, instanceId: string) => {
    const [result] = await redeployStackLocal(stackId, { instanceIds: [instanceId] });
    if (!result || result.status !== 'success') {
      throw new Error(result?.message || 'Falha ao realizar redeploy.');
    }
  };

  const handleConfirm = async () => {
    if (!stack) {
      setConfirmError('Nenhuma stack selecionada.');
      return;
    }
    if (!stack.instanceId) {
      setConfirmError('Instancia nao encontrada para esta stack.');
      return;
    }
    if (!localStack) {
      setConfirmError('Stack global nao encontrada para esta stack.');
      return;
    }
    const instanceId = stack.instanceId;
    if (confirmValue.trim().toLowerCase() !== CONFIRM_WORD) {
      setConfirmError('Digite "redeploy" para confirmar.');
      return;
    }

    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const preview = await runPreview(localStack.id, instanceId);
      if (!preview.isValid) {
        setVariablesOpen(true);
        await loadVariables(localStack.id, instanceId);
        return;
      }
      await executeRedeploy(localStack.id, instanceId);
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao realizar redeploy.';
      setConfirmError(message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSaveVariables = async () => {
    if (!stack || !stack.instanceId || !localStack) {
      setVariablesError('Stack ou instancia invalida.');
      return;
    }
    const instanceId = stack.instanceId;
    const missingRequired = stackVariables
      .filter((variable) => variable.isRequired && !drafts[variable.variableName]?.trim())
      .map((variable) => variable.variableName);
    if (missingRequired.length > 0) {
      setVariablesError(`Preencha as variaveis obrigatorias: ${missingRequired.join(', ')}`);
      return;
    }

    setVariablesSaving(true);
    setVariablesError(null);
    try {
      const updates = stackVariables
        .map((variable) => ({
          variableName: variable.variableName,
          value: drafts[variable.variableName] ?? '',
        }))
        .filter((item) => item.value.trim().length > 0);
      await Promise.all(
        updates.map((item) =>
          upsertInstanceVariable(localStack.id, instanceId, item.variableName, item.value)
        )
      );

      const preview = await runPreview(localStack.id, instanceId);
      if (!preview.isValid) {
        const missing = preview.missingVariables.join(', ');
        const unknown = preview.unknownVariables.join(', ');
        const extra = [
          missing ? `Faltantes: ${missing}` : null,
          unknown ? `Desconhecidas: ${unknown}` : null,
        ]
          .filter(Boolean)
          .join(' | ');
        setVariablesError(extra || 'As variaveis ainda estao incompletas.');
        return;
      }

      await executeRedeploy(localStack.id, instanceId);
      setVariablesOpen(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao realizar redeploy.';
      setVariablesError(message);
    } finally {
      setVariablesSaving(false);
    }
  };

  const renderIssues = () => {
    if (!previewIssues) {
      return null;
    }
    const hasMissing = previewIssues.missingVariables.length > 0;
    const hasUnknown = previewIssues.unknownVariables.length > 0;
    if (!hasMissing && !hasUnknown) {
      return null;
    }
    return (
      <div className="inline-warning">
        {hasMissing && (
          <p>Variaveis faltantes: {previewIssues.missingVariables.join(', ')}</p>
        )}
        {hasUnknown && (
          <p>Variaveis desconhecidas: {previewIssues.unknownVariables.join(', ')}</p>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal isOpen={isOpen} title="Confirmar redeploy" onClose={onClose}>
        {confirmError && <div className="inline-alert">{confirmError}</div>}
        <div className="redeploy-summary">
          {stack && (
            <div className="redeploy-stack">
              <strong>{stack.name}</strong>
              <span>{stack.instanceName ?? `Endpoint ${stack.endpointId}`}</span>
            </div>
          )}
          <p>
            Este procedimento remove a stack atual da instancia e cria uma nova a partir da versao atual.
          </p>
          <p>
            Confirme digitando <strong>redeploy</strong> para continuar.
          </p>
        </div>
        <div className="form-grid">
          <label>
            Confirmacao
            <input
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder="redeploy"
              disabled={confirmLoading}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={handleConfirm} disabled={confirmLoading}>
            {confirmLoading ? 'Validando...' : 'Confirmar'}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={confirmLoading}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={variablesOpen}
        title="Completar variaveis da instancia"
        onClose={() => setVariablesOpen(false)}
      >
        {variablesError && <div className="inline-alert">{variablesError}</div>}
        {renderIssues()}
        {variablesLoading ? (
          <div className="empty-state">Carregando...</div>
        ) : stackVariables.length === 0 ? (
          <div className="empty-state">Nenhuma variavel cadastrada para esta stack.</div>
        ) : (
          <table className="table redeploy-variables-table">
            <thead>
              <tr>
                <th>Variavel</th>
                <th>Obrigatoria</th>
                <th>Default</th>
                <th>Valor na instancia</th>
              </tr>
            </thead>
            <tbody>
              {stackVariables.map((variable) => (
                <tr key={variable.id}>
                  <td>
                    <div className="stack-name">{variable.variableName}</div>
                    <div className="stack-description">{variable.description ?? 'Sem descricao'}</div>
                  </td>
                  <td>{variable.isRequired ? 'Sim' : 'Nao'}</td>
                  <td>{variable.defaultValue ?? 'n/a'}</td>
                  <td>
                    <input
                      value={drafts[variable.variableName] ?? ''}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [variable.variableName]: event.target.value,
                        }))
                      }
                      placeholder={variable.defaultValue ?? ''}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="modal-actions">
          <button
            type="button"
            onClick={handleSaveVariables}
            disabled={variablesSaving || variablesLoading}
          >
            {variablesSaving ? 'Salvando...' : 'Salvar variaveis e continuar'}
          </button>
          <button type="button" className="secondary" onClick={() => setVariablesOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </>
  );
}
