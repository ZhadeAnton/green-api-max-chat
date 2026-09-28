export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type MessageStatus =
  'sending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'uncertain';

export interface Message {
  id: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status?: MessageStatus;
  error?: string;
}

export interface Chat {
  id: string;
  name: string;
  phone: string;
  color: number;
  unread: number;
  messages: Message[];
}

export type ChatEvent =
  | { kind: 'message'; chatId: string; name: string; phone: string; message: Message }
  | { kind: 'status'; chatId: string; messageId: string; status: MessageStatus }
  | { kind: 'account'; state: string };

export interface Notification {
  receiptId: number;
  body: Record<string, unknown>;
}

export type Connection = {
  status: 'connecting' | 'connected' | 'retrying' | 'error';
  message?: string;
};
