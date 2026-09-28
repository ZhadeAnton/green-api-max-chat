import type { Chat, ChatEvent, Message, MessageStatus } from '../types';
import { formatPhone } from './format';

export interface ChatState {
  chats: Chat[];
  activeId: string | null;
  earlyStatuses: Record<string, MessageStatus>;
}

export const initialChatState: ChatState = { chats: [], activeId: null, earlyStatuses: {} };

export type ChatAction =
  | { type: 'open'; chatId: string; phone: string; name?: string }
  | { type: 'select'; chatId: string | null }
  | { type: 'event'; event: ChatEvent; visible: boolean }
  | { type: 'send'; chatId: string; message: Message }
  | { type: 'confirm'; chatId: string; localId: string; messageId: string }
  | { type: 'fail'; chatId: string; localId: string; error: string; uncertain: boolean }
  | { type: 'read' };

export function advanceStatus(
  previous: MessageStatus | undefined,
  next: MessageStatus,
): MessageStatus {
  const rank: Partial<Record<MessageStatus, number>> = {
    sending: 0,
    queued: 1,
    sent: 2,
    delivered: 3,
    read: 4,
  };
  if (previous === 'read' || previous === 'delivered')
    return (rank[next] ?? -1) > (rank[previous] ?? -1) ? next : previous;
  return (rank[previous ?? 'sending'] ?? -1) > (rank[next] ?? -1) && next !== 'failed'
    ? previous!
    : next;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'select')
    return {
      ...state,
      activeId: action.chatId,
      chats: state.chats.map((chat) => (chat.id === action.chatId ? { ...chat, unread: 0 } : chat)),
    };
  if (action.type === 'read')
    return {
      ...state,
      chats: state.chats.map((chat) =>
        chat.id === state.activeId ? { ...chat, unread: 0 } : chat,
      ),
    };
  if (action.type === 'open') {
    const existing = state.chats.find((chat) => chat.id === action.chatId);
    return {
      ...state,
      activeId: action.chatId,
      chats: existing
        ? state.chats.map((chat) =>
            chat.id === existing.id
              ? { ...chat, unread: 0, phone: action.phone || chat.phone }
              : chat,
          )
        : [
            ...state.chats,
            {
              id: action.chatId,
              phone: action.phone,
              name: action.name || formatPhone(action.phone),
              color: state.chats.length % 5,
              unread: 0,
              messages: [],
            },
          ],
    };
  }
  if (action.type === 'event') {
    const event = action.event;
    if (event.kind === 'account') return state;
    if (event.kind === 'status') {
      const found = state.chats.some(
        (chat) =>
          chat.id === event.chatId &&
          chat.messages.some((message) => message.id === event.messageId),
      );
      if (!found) {
        // Statuses may race with the SendMessage response. Keep a bounded cache.
        const entries = Object.entries(state.earlyStatuses).slice(-199);
        const key = `${event.chatId}:${event.messageId}`;
        return {
          ...state,
          earlyStatuses: {
            ...Object.fromEntries(entries),
            [key]: advanceStatus(state.earlyStatuses[key], event.status),
          },
        };
      }
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id !== event.chatId
            ? chat
            : {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id !== event.messageId
                    ? message
                    : { ...message, status: advanceStatus(message.status, event.status) },
                ),
              },
        ),
      };
    }
    let chats = state.chats;
    const existing = chats.find((chat) => chat.id === event.chatId);
    if (existing?.messages.some((message) => message.id === event.message.id)) return state;
    if (!existing)
      chats = [
        ...chats,
        {
          id: event.chatId,
          phone: event.phone,
          name: event.name || formatPhone(event.phone) || 'Собеседник',
          color: chats.length % 5,
          unread: 0,
          messages: [],
        },
      ];
    return {
      ...state,
      chats: chats.map((chat) =>
        chat.id !== event.chatId
          ? chat
          : {
              ...chat,
              name: event.name || chat.name,
              phone: event.phone || chat.phone,
              unread: state.activeId === chat.id && action.visible ? 0 : chat.unread + 1,
              messages: [...chat.messages, event.message].sort((a, b) => a.timestamp - b.timestamp),
            },
      ),
    };
  }
  if (action.type === 'send')
    return {
      ...state,
      chats: state.chats.map((chat) =>
        chat.id === action.chatId
          ? { ...chat, messages: [...chat.messages, action.message] }
          : chat,
      ),
    };
  if (action.type === 'confirm') {
    const key = `${action.chatId}:${action.messageId}`;
    const earlyStatuses = { ...state.earlyStatuses };
    const status = earlyStatuses[key] ?? 'queued';
    delete earlyStatuses[key];
    return {
      ...state,
      earlyStatuses,
      chats: state.chats.map((chat) =>
        chat.id !== action.chatId
          ? chat
          : {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id !== action.localId
                  ? message
                  : { ...message, id: action.messageId, status },
              ),
            },
      ),
    };
  }
  if (action.type === 'fail')
    return {
      ...state,
      chats: state.chats.map((chat) =>
        chat.id !== action.chatId
          ? chat
          : {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id !== action.localId
                  ? message
                  : {
                      ...message,
                      status: action.uncertain ? 'uncertain' : 'failed',
                      error: action.error,
                    },
              ),
            },
      ),
    };
  return state;
}
