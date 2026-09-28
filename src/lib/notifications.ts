import type { ChatEvent, MessageStatus } from '../types';
import { isRecord } from './guards';

const MESSAGE_STATUSES: ReadonlySet<string> = new Set(['sent', 'delivered', 'read', 'failed']);

function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === 'string' && MESSAGE_STATUSES.has(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function parseNotification(body: Record<string, unknown>): ChatEvent | null {
  if (body.typeWebhook === 'stateInstanceChanged') {
    return { kind: 'account', state: text(body.stateInstance) };
  }
  if (body.typeWebhook === 'outgoingMessageStatus') {
    if (!isMessageStatus(body.status) || !text(body.idMessage) || !text(body.chatId)) {
      return null;
    }
    return {
      kind: 'status',
      messageId: text(body.idMessage),
      chatId: text(body.chatId),
      status: body.status,
    };
  }
  if (body.typeWebhook !== 'incomingMessageReceived') {
    return null;
  }
  const sender = record(body.senderData);
  const data = record(body.messageData);
  const chatId = text(sender.chatId);
  const id = text(body.idMessage);
  // This test assignment supports personal text conversations only.
  if (
    !chatId ||
    !id ||
    sender.chatType === 'group' ||
    chatId.startsWith('-') ||
    chatId.endsWith('@g.us')
  ) {
    return null;
  }
  let messageText: string;
  if (data.typeMessage === 'textMessage') {
    messageText = text(record(data.textMessageData).textMessage);
  } else if (data.typeMessage === 'extendedTextMessage') {
    messageText = text(record(data.extendedTextMessageData).text);
  } else {
    return null;
  }
  if (!messageText) {
    return null;
  }
  const phone =
    typeof sender.senderPhoneNumber === 'number' && sender.senderPhoneNumber > 0
      ? String(sender.senderPhoneNumber)
      : text(sender.senderPhoneNumber).replace(/\D/g, '');
  return {
    kind: 'message',
    chatId,
    phone,
    name: text(sender.senderContactName) || text(sender.senderName) || text(sender.chatName),
    message: {
      id,
      text: messageText,
      timestamp:
        typeof body.timestamp === 'number' &&
        Number.isFinite(body.timestamp) &&
        body.timestamp > 0 &&
        body.timestamp <= 8.64e12
          ? body.timestamp * 1000
          : Date.now(),
      direction: 'incoming',
    },
  };
}
