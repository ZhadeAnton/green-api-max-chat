import type { ReactNode } from 'react';
import { formatTime } from '../lib/format';
import type { Chat } from '../types';
import { Avatar } from './Avatar';

interface ChatListItemProps {
  chat: Chat;
  draft: string;
  selected: boolean;
  onSelect: () => void;
}

export function ChatListItem({ chat, draft, selected, onSelect }: ChatListItemProps) {
  const lastMessage = chat.messages.at(-1);
  let preview: ReactNode = 'Начните разговор';

  if (draft) {
    preview = (
      <>
        <em>Черновик: </em>
        {draft}
      </>
    );
  } else if (lastMessage) {
    preview = (
      <>
        {lastMessage.direction === 'outgoing' && <span className="you-prefix">Вы: </span>}
        {lastMessage.text}
      </>
    );
  }

  return (
    <button
      type="button"
      className={`chat-list-item${selected ? ' active' : ''}`}
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
    >
      <Avatar name={chat.name} color={chat.color} />
      <span className="chat-list-copy">
        <span className="chat-list-top">
          <strong>{chat.name}</strong>
          {lastMessage && <time>{formatTime(lastMessage.timestamp)}</time>}
        </span>
        <span className="chat-list-bottom">
          <span className="chat-preview-text">{preview}</span>
          {chat.unread > 0 && (
            <span className="unread-badge" role="img" aria-label={`${chat.unread} непрочитанных`}>
              {chat.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
