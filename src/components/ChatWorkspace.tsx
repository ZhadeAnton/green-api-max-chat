import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Info,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  SendHorizontal,
  Settings2,
  SquarePen,
  X,
} from 'lucide-react';
import type { Chat, Message } from '../types';
import { useChatSession, type Session } from '../hooks/useChatSession';
import { formatDay, formatPhone, formatTime, MESSAGE_LIMIT } from '../lib/format';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { Modal } from './Modal';
import { NewChat } from './NewChat';

function MessageState({ message }: { message: Message }) {
  const titles = {
    sending: 'Отправляется',
    queued: 'Принято GREEN-API, ожидает отправки',
    sent: 'Отправлено',
    delivered: 'Доставлено',
    read: 'Прочитано',
    failed: 'Не отправлено',
    uncertain: 'Отправка не подтверждена',
  };
  const status = message.status ?? 'queued';
  let icon: ReactNode = <Check size={14} />;
  if (status === 'read' || status === 'delivered') icon = <CheckCheck size={15} />;
  if (status === 'sending' || status === 'queued') icon = <Clock3 size={12} />;
  if (status === 'failed' || status === 'uncertain') icon = <AlertCircle size={14} />;
  return (
    <span
      className={`message-status status-${status}`}
      title={titles[status]}
      aria-label={titles[status]}
    >
      {icon}
    </span>
  );
}

function ChatThread({
  chat,
  draft,
  onDraft,
  onSend,
  onBack,
  disabled,
}: {
  chat: Chat;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => boolean;
  onBack: () => void;
  disabled: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const previousCount = useRef(chat.messages.length);
  const [newBelow, setNewBelow] = useState(false);
  const pending = chat.messages.some((message) => message.status === 'sending');
  const tooLong = draft.length > MESSAGE_LIMIT;
  const lastMessage = chat.messages.at(-1);

  function scrollToBottom() {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    nearBottom.current = true;
    setNewBelow(false);
  }
  useLayoutEffect(() => {
    if (nearBottom.current) scrollToBottom();
    else if (chat.messages.length > previousCount.current) setNewBelow(true);
    previousCount.current = chat.messages.length;
  }, [chat.messages.length, lastMessage?.id, lastMessage?.status]);
  useLayoutEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = '0px';
    textarea.current.style.height = `${Math.min(Math.max(textarea.current.scrollHeight, 24), 120)}px`;
  }, [draft]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || tooLong || pending || disabled) return;
    if (onSend(draft)) {
      onDraft('');
      textarea.current?.focus();
      nearBottom.current = true;
    }
  }

  return (
    <section className="chat-pane" aria-label={`Переписка с ${chat.name}`}>
      <header className="chat-header">
        <button
          className="icon-button mobile-back"
          aria-label="Вернуться к списку чатов"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </button>
        <Avatar name={chat.name} color={chat.color} small />
        <div className="chat-heading">
          <h2>{chat.name}</h2>
          <p>{formatPhone(chat.phone) || 'Личный чат в MAX'}</p>
        </div>
        <span className="chat-kind">
          <MessageCircle size={15} /> Личный чат
        </span>
      </header>
      <div className="messages-area">
        <div
          className="messages-scroll"
          ref={scroller}
          onScroll={() => {
            const element = scroller.current;
            if (element) {
              nearBottom.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 100;
              if (nearBottom.current) setNewBelow(false);
            }
          }}
        >
          <div
            className="messages-content"
            role="log"
            aria-label="Сообщения"
            aria-live="polite"
            aria-relevant="additions"
          >
            {chat.messages.length === 0 && (
              <div className="thread-empty">
                <Avatar name={chat.name} color={chat.color} />
                <h3>Скажите «привет»</h3>
                <p>Здесь начнётся ваш разговор с {chat.name}.</p>
              </div>
            )}
            {chat.messages.map((message, index) => {
              const previous = chat.messages[index - 1];
              const day = formatDay(message.timestamp);
              const showDay = !previous || formatDay(previous.timestamp) !== day;
              const failed = message.status === 'failed' || message.status === 'uncertain';
              return (
                <div className="message-block" key={message.id}>
                  {showDay && (
                    <div className="date-separator">
                      <span>{day}</span>
                    </div>
                  )}
                  <div className={`message-row ${message.direction}`}>
                    <div className={`message-bubble${failed ? ' message-failed' : ''}`}>
                      <p>{message.text}</p>
                      <div className="message-meta">
                        <time dateTime={new Date(message.timestamp).toISOString()}>
                          {formatTime(message.timestamp)}
                        </time>
                        {message.direction === 'outgoing' && <MessageState message={message} />}
                      </div>
                    </div>
                  </div>
                  {failed && (
                    <div className="send-error" role="alert">
                      <AlertCircle size={13} />
                      <span>
                        {message.error || 'Не удалось отправить сообщение.'}
                        {message.status === 'uncertain' &&
                          ' Сообщение могло быть отправлено — проверьте MAX перед повтором.'}
                      </span>
                      <button
                        onClick={() => {
                          onDraft(message.text);
                          textarea.current?.focus();
                        }}
                      >
                        В черновик
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {newBelow && (
          <button className="new-below" onClick={scrollToBottom}>
            <ArrowDown size={16} /> Новые сообщения
          </button>
        )}
      </div>
      <div className="composer-wrapper">
        <form className={`composer${tooLong ? ' composer-invalid' : ''}`} onSubmit={submit}>
          <textarea
            ref={textarea}
            aria-label="Сообщение"
            placeholder="Написать сообщение…"
            value={draft}
            rows={1}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button
            className="send-button"
            type="submit"
            aria-label="Отправить сообщение"
            disabled={!draft.trim() || tooLong || pending || disabled}
          >
            <SendHorizontal size={21} />
          </button>
        </form>
        <div className="composer-caption">
          <span>
            {pending ? 'Отправляем сообщение…' : 'Enter — отправить · Shift + Enter — новая строка'}
          </span>
          <span className={tooLong ? 'count-error' : ''} aria-live="polite">
            {draft.length > 0 ? `${draft.length} / ${MESSAGE_LIMIT}` : 'Текстовые сообщения'}
          </span>
        </div>
      </div>
    </section>
  );
}

export function ChatWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { state, connection, openChat, sendMessage, selectChat, reconnect } =
    useChatSession(session);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [modal, setModal] = useState<'new' | 'help' | 'logout' | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const demo = session.kind === 'demo';
  const unread = state.chats.reduce((sum, chat) => sum + chat.unread, 0);
  const active = state.chats.find((chat) => chat.id === state.activeId);
  const filtered = state.chats
    .filter((chat) => {
      const matchesName = chat.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'));
      const digits = query.replace(/\D/g, '');
      return (
        (matchesName || (digits.length > 0 && chat.phone.includes(digits))) &&
        (filter === 'all' || chat.unread > 0)
      );
    })
    .sort((a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0));
  const connectionLabel = demo
    ? 'Демонстрационный режим'
    : (
        {
          connected: 'Подключено',
          connecting: 'Подключаемся…',
          retrying: 'Восстанавливаем связь',
          error: 'Нет подключения',
        } as const
      )[connection.status];
  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ''}MAX Chat · GREEN-API`;
    return () => {
      document.title = 'MAX Chat · GREEN-API';
    };
  }, [unread]);

  return (
    <main className="workspace-page">
      <header className="page-header workspace-header">
        <Brand />
        <div className="workspace-header-right">
          <span className="workspace-note">Место для ваших разговоров</span>
          <span className="provider-badge">
            <span className="green-dot" /> GREEN-API
          </span>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>
            <Info size={16} />
            <strong>Вы в деморежиме.</strong> Сообщения и контакты вымышлены.
          </span>
          <button onClick={onLogout}>
            Подключить свой MAX <ArrowRight size={15} />
          </button>
        </div>
      )}
      {!demo && connection.message && (
        <div className={`connection-banner ${connection.status}`} role="status">
          <AlertCircle size={17} />
          <span>{connection.message}</span>
          {connection.status === 'error' && <button onClick={reconnect}>Повторить</button>}
        </div>
      )}
      <div className={`messenger-shell${active ? ' has-active-chat' : ''}`}>
        <nav className="app-rail" aria-label="Навигация">
          <div className="rail-top">
            <Brand compact />
            <button
              className="rail-button selected"
              aria-label="Все чаты"
              onClick={() => {
                setFilter('all');
                setQuery('');
              }}
            >
              <MessageCircle size={22} />
              {unread > 0 && <span className="rail-unread" />}
            </button>
            <button
              className="rail-button"
              aria-label="Создать новый чат"
              onClick={() => setModal('new')}
            >
              <SquarePen size={21} />
            </button>
          </div>
          <div className="rail-bottom">
            <button
              className="rail-button"
              aria-label="О подключении"
              onClick={() => setModal('help')}
            >
              <Settings2 size={22} />
            </button>
            <button
              className="account-avatar"
              aria-label="Выйти из чата"
              onClick={() => setModal('logout')}
            >
              Я
            </button>
          </div>
        </nav>
        <aside className="chat-sidebar" aria-label="Список чатов">
          <div className="sidebar-header">
            <div>
              <h1>
                Сообщения <span>{state.chats.length}</span>
              </h1>
              <p>Оставайтесь на связи</p>
            </div>
            <button
              className="new-chat-button"
              aria-label="Новый чат"
              onClick={() => setModal('new')}
            >
              <Plus size={23} />
            </button>
          </div>
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Поиск чатов"
              placeholder="Найти разговор"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Очистить поиск"
                onClick={() => setQuery('')}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="chat-filters" aria-label="Фильтр чатов">
            <button
              aria-pressed={filter === 'all'}
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Все чаты
            </button>
            <button
              aria-pressed={filter === 'unread'}
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Непрочитанные {unread > 0 && <span>{unread}</span>}
            </button>
          </div>
          <div className="chat-list">
            {filtered.map((chat) => {
              const last = chat.messages.at(-1);
              return (
                <button
                  key={chat.id}
                  className={`chat-list-item${chat.id === active?.id ? ' active' : ''}`}
                  onClick={() => selectChat(chat.id)}
                  aria-current={chat.id === active?.id ? 'true' : undefined}
                >
                  <Avatar name={chat.name} color={chat.color} />
                  <span className="chat-list-copy">
                    <span className="chat-list-top">
                      <strong>{chat.name}</strong>
                      {last && <time>{formatTime(last.timestamp)}</time>}
                    </span>
                    <span className="chat-list-bottom">
                      <span className="chat-preview-text">
                        {drafts[chat.id] ? (
                          <>
                            <em>Черновик: </em>
                            {drafts[chat.id]}
                          </>
                        ) : last ? (
                          <>
                            {last.direction === 'outgoing' && (
                              <span className="you-prefix">Вы: </span>
                            )}
                            {last.text}
                          </>
                        ) : (
                          'Начните разговор'
                        )}
                      </span>
                      {chat.unread > 0 && (
                        <span className="unread-badge" aria-label={`${chat.unread} непрочитанных`}>
                          {chat.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="sidebar-empty">
                <MessageCircle size={30} />
                <h3>{state.chats.length ? 'Здесь пока тихо' : 'Ваш первый разговор'}</h3>
                <p>
                  {query
                    ? 'Попробуйте другое имя или номер.'
                    : filter === 'unread'
                      ? 'Вы прочитали все сообщения.'
                      : 'Добавьте собеседника по номеру телефона.'}
                </p>
                {!state.chats.length && (
                  <button className="text-button" onClick={() => setModal('new')}>
                    Создать чат <Plus size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="sidebar-footer">
            <button className="session-info" onClick={() => setModal('help')}>
              <span className={`connection-dot ${connection.status}`} />
              <span>
                <strong>{demo ? 'Демоаккаунт' : 'Ваш MAX'}</strong>
                <small>{connectionLabel}</small>
              </span>
            </button>
            <button
              className="icon-button"
              aria-label="Завершить сеанс"
              onClick={() => setModal('logout')}
            >
              <LogOut size={19} />
            </button>
          </div>
        </aside>
        <div className="conversation-column">
          {active ? (
            <ChatThread
              key={active.id}
              chat={active}
              draft={drafts[active.id] ?? ''}
              onDraft={(value) => setDrafts((previous) => ({ ...previous, [active.id]: value }))}
              onSend={(value) => sendMessage(active.id, value)}
              onBack={() => selectChat(null)}
              disabled={
                !demo && (connection.status === 'error' || connection.status === 'connecting')
              }
            />
          ) : (
            <section className="conversation-empty">
              <div className="empty-illustration">
                <MessageCircle size={54} strokeWidth={1.4} />
                <span>👋</span>
              </div>
              <div className="eyebrow">РАЗГОВОРЫ, КОТОРЫЕ ВАЖНЫ</div>
              <h2>С кем поговорим сегодня?</h2>
              <p>
                Выберите чат слева или начните новый.
                <br />
                Хорошее сообщение всегда кстати.
              </p>
              <button className="button button-primary" onClick={() => setModal('new')}>
                <Plus size={18} /> Начать разговор
              </button>
              <span className="empty-footnote">
                <LockKeyhole size={13} /> Ваша переписка — только в этой вкладке
              </span>
            </section>
          )}
        </div>
      </div>
      <footer className="page-footer workspace-footer">
        <span>
          <span className={`connection-dot ${connection.status}`} />
          {connectionLabel}
        </span>
        <button className="text-button" onClick={() => setModal('help')}>
          Как это работает <ChevronRight size={13} />
        </button>
      </footer>
      {modal === 'new' && (
        <NewChat
          demo={demo}
          onClose={() => setModal(null)}
          onCreate={async (phone, signal) => {
            await openChat(phone, signal);
            if (!signal.aborted) {
              setQuery('');
              setFilter('all');
            }
          }}
        />
      )}
      {modal === 'help' && (
        <Modal title="О подключении" onClose={() => setModal(null)}>
          <p className="muted">
            {demo
              ? 'Сейчас работает деморежим с вымышленными контактами и автоматическими ответами.'
              : 'Вы подключены к своему аккаунту MAX через GREEN-API.'}
          </p>
          {session.kind === 'live' && (
            <div className="connection-details">
              <span>
                Инстанс <strong>{session.api.credentials.idInstance}</strong>
              </span>
              <span>
                Сервер <strong>{new URL(session.api.credentials.apiUrl).hostname}</strong>
              </span>
            </div>
          )}
          <div className="help-item">
            <MessageCircle size={20} />
            <div>
              <strong>Личные текстовые сообщения</strong>
              <p>Создайте чат по номеру телефона. Ответы из MAX появляются автоматически.</p>
            </div>
          </div>
          <div className="help-item">
            <LockKeyhole size={20} />
            <div>
              <strong>Одна вкладка — один сеанс</strong>
              <p>
                Данные остаются в памяти этой вкладки. Обновление страницы или выход очищают ключ и
                локальную переписку.
              </p>
            </div>
          </div>
          <a
            className="button button-secondary button-full"
            href="https://green-api.com/v3/docs/before-start/"
            target="_blank"
            rel="noreferrer"
          >
            Настроить GREEN-API <ExternalLink size={16} />
          </a>
          {demo && (
            <button className="button button-primary button-full" onClick={onLogout}>
              Подключить свой MAX <ArrowRight size={16} />
            </button>
          )}
        </Modal>
      )}
      {modal === 'logout' && (
        <Modal title="Завершить сеанс?" onClose={() => setModal(null)}>
          <p className="muted">
            Ключ доступа, черновики и переписка в этой вкладке будут очищены. Сообщения в MAX
            сохранятся.
          </p>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={() => setModal(null)}>
              Остаться
            </button>
            <button className="button button-primary" onClick={onLogout}>
              Выйти <LogOut size={16} />
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
