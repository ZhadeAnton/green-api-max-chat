import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Info,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  Settings2,
  SquarePen,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Session, useChatSession } from '../hooks/useChatSession';
import type { Connection } from '../types';
import { Brand } from './Brand';
import { type ChatFilter, ChatSidebar } from './ChatSidebar';
import { ChatThread } from './ChatThread';
import { Modal } from './Modal';
import { NewChat } from './NewChat';

const CONNECTION_LABELS: Record<Connection['status'], string> = {
  connected: 'Подключено',
  connecting: 'Подключаемся…',
  retrying: 'Восстанавливаем связь',
  error: 'Нет подключения',
};

interface ChatWorkspaceProps {
  session: Session;
  onLogout: () => void;
}

export function ChatWorkspace({ session, onLogout }: ChatWorkspaceProps) {
  const { state, connection, openChat, sendMessage, selectChat, reconnect } =
    useChatSession(session);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [modal, setModal] = useState<'new' | 'help' | 'logout' | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const demo = session.kind === 'demo';
  const unread = state.chats.reduce((sum, chat) => sum + chat.unread, 0);
  const active = state.chats.find((chat) => chat.id === state.activeId);
  const filtered = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('ru');
    const queryDigits = query.replace(/\D/g, '');

    return state.chats
      .filter((chat) => {
        const matchesName = chat.name.toLocaleLowerCase('ru').includes(normalizedQuery);
        const matchesPhone = queryDigits.length > 0 && chat.phone.includes(queryDigits);

        return (matchesName || matchesPhone) && (filter === 'all' || chat.unread > 0);
      })
      .sort((a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0));
  }, [filter, query, state.chats]);
  const connectionLabel = demo ? 'Демонстрационный режим' : CONNECTION_LABELS[connection.status];

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
          <button type="button" onClick={onLogout}>
            Подключить свой MAX <ArrowRight size={15} />
          </button>
        </div>
      )}
      {!demo && connection.message && (
        <div className={`connection-banner ${connection.status}`} role="status">
          <AlertCircle size={17} />
          <span>{connection.message}</span>
          {connection.status === 'error' && (
            <button type="button" onClick={reconnect}>
              Повторить
            </button>
          )}
        </div>
      )}
      <div className={`messenger-shell${active ? ' has-active-chat' : ''}`}>
        <nav className="app-rail" aria-label="Навигация">
          <div className="rail-top">
            <Brand compact />
            <button
              type="button"
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
              type="button"
              className="rail-button"
              aria-label="Создать новый чат"
              onClick={() => setModal('new')}
            >
              <SquarePen size={21} />
            </button>
          </div>
          <div className="rail-bottom">
            <button
              type="button"
              className="rail-button"
              aria-label="О подключении"
              onClick={() => setModal('help')}
            >
              <Settings2 size={22} />
            </button>
            <button
              type="button"
              className="account-avatar"
              aria-label="Выйти из чата"
              onClick={() => setModal('logout')}
            >
              Я
            </button>
          </div>
        </nav>
        <ChatSidebar
          chats={filtered}
          totalChats={state.chats.length}
          activeChatId={active?.id}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          unread={unread}
          drafts={drafts}
          demo={demo}
          connection={connection}
          connectionLabel={connectionLabel}
          selectChat={selectChat}
          onNewChat={() => setModal('new')}
          onHelp={() => setModal('help')}
          onLogout={() => setModal('logout')}
        />
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
                <span className="empty-wave">👋</span>
              </div>
              <div className="eyebrow">РАЗГОВОРЫ, КОТОРЫЕ ВАЖНЫ</div>
              <h2>С кем поговорим сегодня?</h2>
              <p>
                Выберите чат слева или начните новый.
                <br />
                Хорошее сообщение всегда кстати.
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setModal('new')}
              >
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
        <button type="button" className="text-button" onClick={() => setModal('help')}>
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
              <span className="connection-detail">
                Инстанс <strong>{session.api.credentials.idInstance}</strong>
              </span>
              <span className="connection-detail">
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
            <button type="button" className="button button-primary button-full" onClick={onLogout}>
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
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Остаться
            </button>
            <button type="button" className="button button-primary" onClick={onLogout}>
              Выйти <LogOut size={16} />
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
