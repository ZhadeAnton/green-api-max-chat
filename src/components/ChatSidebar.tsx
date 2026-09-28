import { LogOut, MessageCircle, Plus, Search, X } from 'lucide-react';
import type { Chat, Connection } from '../types';
import { ChatListItem } from './ChatListItem';

export type ChatFilter = 'all' | 'unread';

interface ChatSidebarProps {
  chats: Chat[];
  totalChats: number;
  activeChatId?: string;
  query: string;
  setQuery: (value: string) => void;
  filter: ChatFilter;
  setFilter: (value: ChatFilter) => void;
  unread: number;
  drafts: Record<string, string>;
  demo: boolean;
  connection: Connection;
  connectionLabel: string;
  selectChat: (chatId: string) => void;
  onNewChat: () => void;
  onHelp: () => void;
  onLogout: () => void;
}

export function ChatSidebar({
  chats,
  totalChats,
  activeChatId,
  query,
  setQuery,
  filter,
  setFilter,
  unread,
  drafts,
  demo,
  connection,
  connectionLabel,
  selectChat,
  onNewChat,
  onHelp,
  onLogout,
}: ChatSidebarProps) {
  let emptyMessage = 'Добавьте собеседника по номеру телефона.';

  if (query) {
    emptyMessage = 'Попробуйте другое имя или номер.';
  } else if (filter === 'unread') {
    emptyMessage = 'Вы прочитали все сообщения.';
  }

  return (
    <aside className="chat-sidebar" aria-label="Список чатов">
      <div className="sidebar-header">
        <div>
          <h1>
            Сообщения <span className="chat-count">{totalChats}</span>
          </h1>
          <p>Оставайтесь на связи</p>
        </div>
        <button
          type="button"
          className="new-chat-button"
          aria-label="Новый чат"
          onClick={onNewChat}
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
            type="button"
            className="icon-button"
            aria-label="Очистить поиск"
            onClick={() => setQuery('')}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <fieldset className="chat-filters">
        <legend className="visually-hidden">Фильтр чатов</legend>
        <button
          type="button"
          aria-pressed={filter === 'all'}
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          Все чаты
        </button>
        <button
          type="button"
          aria-pressed={filter === 'unread'}
          className={filter === 'unread' ? 'active' : ''}
          onClick={() => setFilter('unread')}
        >
          Непрочитанные {unread > 0 && <span>{unread}</span>}
        </button>
      </fieldset>
      <div className="chat-list">
        {chats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            draft={drafts[chat.id] ?? ''}
            selected={chat.id === activeChatId}
            onSelect={() => selectChat(chat.id)}
          />
        ))}
        {chats.length === 0 && (
          <div className="sidebar-empty">
            <MessageCircle size={30} />
            <h3>{totalChats ? 'Здесь пока тихо' : 'Ваш первый разговор'}</h3>
            <p>{emptyMessage}</p>
            {!totalChats && (
              <button type="button" className="text-button" onClick={onNewChat}>
                Создать чат <Plus size={15} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button type="button" className="session-info" onClick={onHelp}>
          <span className={`connection-dot ${connection.status}`} />
          <span>
            <strong>{demo ? 'Демоаккаунт' : 'Ваш MAX'}</strong>
            <small>{connectionLabel}</small>
          </span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Завершить сеанс"
          onClick={onLogout}
        >
          <LogOut size={19} />
        </button>
      </div>
    </aside>
  );
}
