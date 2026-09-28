import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '../types';
import { chatReducer, initialChatState } from './chat-state';
import { parseNotification } from './notifications';

const incoming = {
  typeWebhook: 'incomingMessageReceived',
  idMessage: 'message-1',
  timestamp: 1780000000,
  senderData: {
    chatId: '10000000',
    senderName: 'Александра',
    senderPhoneNumber: 79000000001,
    chatType: 'user',
  },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
};

function incomingEvent(): ChatEvent {
  const event = parseNotification(incoming);

  if (!event) {
    throw new Error('Expected a valid incoming notification.');
  }

  return event;
}

describe('message routing and deduplication', () => {
  it('keeps malformed API timestamps from crashing the message list', () => {
    const event = parseNotification({ ...incoming, timestamp: 1e99 });
    expect(event?.kind).toBe('message');
    if (event?.kind === 'message') {
      expect(Number.isNaN(new Date(event.message.timestamp).getTime())).toBe(false);
    }
  });
  it('routes a MAX notification by canonical chat ID and does not duplicate redeliveries', () => {
    const event = incomingEvent();
    const state = chatReducer(initialChatState, { type: 'event', event, visible: true });
    expect(state.chats[0]).toMatchObject({ id: '10000000', phone: '79000000001', unread: 1 });
    const redelivery = chatReducer(state, { type: 'event', event, visible: true });
    expect(redelivery.chats[0].messages).toHaveLength(1);
    expect(redelivery.chats[0].unread).toBe(1);
  });

  it('keeps messages for inactive chats and clears unread when the chat is selected', () => {
    let state = chatReducer(initialChatState, {
      type: 'open',
      chatId: 'another-chat',
      phone: '79000000002',
    });
    state = chatReducer(state, {
      type: 'event',
      event: incomingEvent(),
      visible: true,
    });
    expect(state.activeId).toBe('another-chat');
    expect(state.chats.find((chat) => chat.id === '10000000')?.unread).toBe(1);
    state = chatReducer(state, { type: 'select', chatId: '10000000' });
    expect(state.chats.find((chat) => chat.id === '10000000')?.unread).toBe(0);
    expect(state.chats).toHaveLength(2);
  });

  it('handles plain text and extended text without rendering file captions or service events as messages', () => {
    const event = parseNotification({
      ...incoming,
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://example.com/' },
      },
    });
    expect(event?.kind === 'message' && event.message.text).toBe('https://example.com/');
    expect(
      parseNotification({
        ...incoming,
        messageData: { typeMessage: 'imageMessage', fileMessageData: { caption: 'Photo' } },
      }),
    ).toBeNull();
    expect(
      parseNotification({ ...incoming, senderData: { chatId: '-123', chatType: 'group' } }),
    ).toBeNull();
    expect(parseNotification({ typeWebhook: 'outgoingAPIMessageReceived' })).toBeNull();
    expect(parseNotification({ ...incoming, senderData: null })).toBeNull();
  });

  it('preserves delivery status when a webhook arrives before the SendMessage response', () => {
    let state = chatReducer(initialChatState, {
      type: 'open',
      chatId: '10000000',
      phone: '79000000001',
    });
    state = chatReducer(state, {
      type: 'send',
      chatId: '10000000',
      message: {
        id: 'local-1',
        text: 'Привет',
        timestamp: 100,
        direction: 'outgoing',
        status: 'sending',
      },
    });
    const event: ChatEvent = {
      kind: 'status',
      chatId: '10000000',
      messageId: 'server-1',
      status: 'delivered',
    };
    state = chatReducer(state, { type: 'event', event, visible: true });
    state = chatReducer(state, {
      type: 'confirm',
      chatId: '10000000',
      localId: 'local-1',
      messageId: 'server-1',
    });
    expect(state.chats[0].messages[0]).toMatchObject({ id: 'server-1', status: 'delivered' });
    state = chatReducer(state, {
      type: 'event',
      event: { ...event, status: 'sent' },
      visible: true,
    });
    expect(state.chats[0].messages[0].status).toBe('delivered');
    expect(state.earlyStatuses).toEqual({});
  });

  it('opening an existing incoming conversation by phone does not create a duplicate', () => {
    let state = chatReducer(initialChatState, {
      type: 'event',
      event: incomingEvent(),
      visible: false,
    });
    state = chatReducer(state, { type: 'open', chatId: '10000000', phone: '79000000001' });
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0].messages).toHaveLength(1);
    expect(state.activeId).toBe('10000000');
  });
});
