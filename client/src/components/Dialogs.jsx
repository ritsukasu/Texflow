import { Loader2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Modal } from './Modal.jsx';

export const ConfirmDialog = ({ open, title, description, confirmLabel = 'Delete', danger = true, onConfirm, onClose }) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      /* the caller reports the failure */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} description={description} width={440}>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={confirm} disabled={busy} data-autofocus>
          {busy && <Loader2 size={16} className="spin" aria-hidden />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export const PromptDialog = ({
  open,
  title,
  description,
  label,
  initialValue = '',
  placeholder,
  submitLabel = 'Save',
  validate,
  onSubmit,
  onClose,
  hint,
  selectBase = false,
}) => {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError('');
      setBusy(false);
    }
  }, [open, initialValue]);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    const problem = validate?.(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (failure) {
      setError(failure?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const selectInitial = (event) => {
    const input = event.currentTarget;
    if (!selectBase) {
      input.select();
      return;
    }
    const dot = input.value.lastIndexOf('.');
    const slash = input.value.lastIndexOf('/');
    input.setSelectionRange(slash + 1, dot > slash ? dot : input.value.length);
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} description={description} width={440}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={inputId}>
            {label}
          </label>
          <input
            id={inputId}
            className="input"
            value={value}
            placeholder={placeholder}
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setError('');
            }}
            onFocus={selectInitial}
            data-autofocus
          />
          {error ? (
            <p className="field-error" id={`${inputId}-error`} role="alert">
              {error}
            </p>
          ) : (
            hint && (
              <p className="field-hint" id={`${inputId}-hint`}>
                {hint}
              </p>
            )
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 size={16} className="spin" aria-hidden />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};
