import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { errorMessage } from '../lib/format';
import { Modal } from './Modal';

export function NewChat({
  onClose,
  onCreate,
  demo,
}: {
  onClose: () => void;
  onCreate: (phone: string, signal: AbortSignal) => Promise<void>;
  demo: boolean;
}) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      await onCreate(phone, controller.signal);
      if (!controller.signal.aborted) onClose();
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Modal title="Новый разговор" onClose={onClose}>
      <div className="modal-symbol">
        <Phone size={25} />
      </div>
      <p className="muted">Введите номер человека, которому хотите написать в MAX.</p>
      <form onSubmit={submit}>
        <label className="field">
          Номер телефона
          <input
            autoFocus
            type="tel"
            autoComplete="tel"
            placeholder="+7 900 123-45-67"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            disabled={busy}
          />
        </label>
        <p className="field-hint">Международный формат: +7 или +375.</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {demo && (
          <p className="demo-help">
            В деморежиме создаётся локальный чат с автоматическими ответами.
          </p>
        )}
        <button className="button button-primary button-full" disabled={busy}>
          {busy ? 'Ищем в MAX…' : 'Начать разговор'}
          {!busy && <ArrowRight size={18} />}
        </button>
      </form>
    </Modal>
  );
}
