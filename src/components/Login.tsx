import {
  ArrowRight,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { Session } from '../hooks/useChatSession';
import { DEFAULT_API_URL, GreenApi } from '../lib/api';
import { errorMessage } from '../lib/format';
import { Avatar } from './Avatar';
import { Brand } from './Brand';

interface LoginProps {
  onStart: (session: Session) => void;
}

export function Login({ onStart }: LoginProps) {
  const [idInstance, setIdInstance] = useState('');
  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      pending.current?.abort();
    };
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (pending.current) {
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setLoading(true);
    try {
      const api = new GreenApi({ idInstance, apiTokenInstance: token, apiUrl });
      await api.connect(controller.signal);
      if (!controller.signal.aborted) {
        onStart({ kind: 'live', api });
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(errorMessage(cause));
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  return (
    <main className="login-page">
      <header className="page-header">
        <Brand />
        <a
          className="provider-badge"
          href="https://green-api.com/max"
          target="_blank"
          rel="noreferrer"
        >
          <span className="green-dot" /> GREEN-API <ExternalLink size={12} />
        </a>
      </header>
      <div className="login-layout">
        <section className="welcome-panel" aria-label="О приложении">
          <div className="eyebrow">
            <span /> БЛИЖЕ, ДАЖЕ НА РАССТОЯНИИ
          </div>
          <h1>
            Хороший разговор
            <br />
            начинается с <span className="welcome-highlight">«привет».</span>
          </h1>
          <p className="welcome-copy">
            Ваши чаты в MAX — в простом и уютном
            <br className="desktop-break" /> интерфейсе. Подключитесь и будьте на связи.
          </p>
          <div className="conversation-preview" aria-hidden="true">
            <div className="preview-header">
              <Avatar name="Александра Морозова" small />
              <div>
                <strong>Александра</strong>
                <span>на связи</span>
              </div>
              <MessageCircle size={20} />
            </div>
            <div className="preview-body">
              <div className="preview-bubble">
                Привет! Есть минутка? 👋<span>12:40</span>
              </div>
              <div className="preview-bubble own">
                Для хорошего разговора — всегда
                <span>
                  12:41 <CheckCheck size={13} />
                </span>
              </div>
              <div className="preview-bubble typing">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="preview-note">
              <span className="green-dot" /> Всё начинается с одного сообщения
            </div>
          </div>
          <div className="welcome-features">
            <span>
              <MessageCircle size={17} /> Только нужное
            </span>
            <span>
              <ShieldCheck size={17} /> Ключи остаются у вас
            </span>
          </div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="card-icon">
            <KeyRound size={23} />
          </div>
          <h2 id="login-title">Подключить MAX</h2>
          <p className="muted">
            Введите данные вашего инстанса
            <br />
            из личного кабинета GREEN-API.
          </p>
          <form onSubmit={connect}>
            <label className="field">
              ID инстанса <span>idInstance</span>
              <input
                name="idInstance"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Например, 3100000001"
                value={idInstance}
                onChange={(event) => setIdInstance(event.target.value)}
                required
                disabled={loading}
              />
            </label>
            <label className="field">
              Ключ доступа <span>apiTokenInstance</span>
              <div className="password-field">
                <input
                  name="apiTokenInstance"
                  type={visible ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder="Ваш ключ доступа"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? 'Скрыть ключ' : 'Показать ключ'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            <details className="server-settings">
              <summary>
                Адрес сервера <ChevronDown className="server-settings-chevron" size={15} />
              </summary>
              <label className="field">
                apiUrl
                <input
                  name="apiUrl"
                  type="url"
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <p>Если адрес в вашем личном кабинете отличается, скопируйте его сюда.</p>
            </details>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-primary button-full" disabled={loading} type="submit">
              {loading ? 'Проверяем подключение…' : 'Подключиться'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="privacy-note">
            <LockKeyhole size={14} />
            <span>Ключ и переписка хранятся только в этой вкладке до обновления страницы.</span>
          </p>
          <div className="divider">
            <span>или сначала познакомимся</span>
          </div>
          <button
            type="button"
            className="button button-secondary button-full"
            disabled={loading}
            onClick={() => onStart({ kind: 'demo' })}
          >
            Посмотреть демо <MessageCircle size={17} />
          </button>
          <a
            className="setup-link"
            href="https://green-api.com/v3/docs/before-start/"
            target="_blank"
            rel="noreferrer"
          >
            Как получить данные для подключения <ExternalLink size={13} />
          </a>
        </section>
      </div>
      <footer className="page-footer">
        <span>Меньше лишнего. Больше общения.</span>
        <span>React · MAX · GREEN-API</span>
      </footer>
    </main>
  );
}
