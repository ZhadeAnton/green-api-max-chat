import { useEffect, useReducer, useRef, useState } from 'react';
import { ApiError, type GreenApi } from '../lib/api';
import { chatReducer, initialChatState } from '../lib/chat-state';
import { createDemoState } from '../lib/demo';
import { errorMessage, MESSAGE_LIMIT, normalizePhone } from '../lib/format';
import { parseNotification } from '../lib/notifications';
import { abortableDelay, pollNotifications } from '../lib/polling';
import { withInstanceLock } from '../lib/session-lock';
import type { Connection } from '../types';

export type Session = { kind: 'live'; api: GreenApi } | { kind: 'demo' };

export function useChatSession(session: Session) {
  const [state, dispatch] = useReducer(chatReducer, undefined, () =>
    session.kind === 'demo' ? createDemoState() : initialChatState,
  );
  const [connection, setConnection] = useState<Connection>({
    status: session.kind === 'demo' ? 'connected' : 'connecting',
  });
  const [retryKey, setRetryKey] = useState(0);
  const requests = useRef<AbortController | null>(null);
  const sending = useRef(new Set<string>());
  const queueOwner = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requests.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        dispatch({ type: 'read' });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  useEffect(() => {
    if (session.kind === 'demo') {
      return;
    }
    const controller = new AbortController();
    let accountUnavailable = false;
    const run = async () => {
      queueOwner.current = controller;
      try {
        if (retryKey > 0) {
          setConnection({ status: 'connecting' });
          await session.api.connect(controller.signal);
        }
        if (controller.signal.aborted) {
          return;
        }
        await pollNotifications(session.api, {
          signal: controller.signal,
          onConnection: (next) => {
            if (!accountUnavailable) {
              setConnection(next.status === 'connecting' ? { status: 'connected' } : next);
            }
          },
          onNotification: (notification) => {
            const event = parseNotification(notification.body);
            if (!event) {
              return;
            }
            if (event.kind === 'account') {
              accountUnavailable = event.state !== 'authorized';
              setConnection(
                accountUnavailable
                  ? {
                      status: 'error',
                      message:
                        'Соединение с MAX прервано. Проверьте авторизацию инстанса в GREEN-API и подключитесь снова.',
                    }
                  : { status: 'connected' },
              );
              // Keep polling; session authorization may recover.
              return;
            }
            dispatch({
              type: 'event',
              event,
              visible: document.visibilityState === 'visible' && document.hasFocus(),
            });
          },
        });
      } finally {
        if (queueOwner.current === controller) {
          queueOwner.current = null;
        }
      }
    };
    void withInstanceLock({
      instanceId: session.api.credentials.idInstance,
      signal: controller.signal,
      locks: navigator.locks,
      onWaiting: () =>
        setConnection({
          status: 'connecting',
          message:
            'Ожидаем доступ к сообщениям. Если этот MAX открыт в другой вкладке, завершите там сеанс.',
        }),
      run,
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setConnection({ status: 'error', message: errorMessage(error) });
      }
    });
    return () => controller.abort();
  }, [session, retryKey]);

  async function openChat(value: string, signal?: AbortSignal): Promise<void> {
    const phone = normalizePhone(value);
    const existing = state.chats.find((chat) => chat.phone === phone);
    if (existing) {
      dispatch({ type: 'select', chatId: existing.id });
      return;
    }
    const sessionSignal = requests.current?.signal;
    if (!sessionSignal) {
      return;
    }
    const combinedSignal = signal ? AbortSignal.any([signal, sessionSignal]) : sessionSignal;
    const chatId =
      session.kind === 'live' ? await session.api.findChat(phone, combinedSignal) : `demo-${phone}`;
    if (combinedSignal.aborted) {
      return;
    }
    dispatch({ type: 'open', chatId, phone });
  }

  async function deliverMessage(
    chatId: string,
    text: string,
    localId: string,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      let messageId: string;
      if (session.kind === 'live') {
        messageId = await session.api.sendMessage(chatId, text, signal);
      } else {
        await abortableDelay(400, signal);
        messageId = `demo-${crypto.randomUUID()}`;
      }
      if (signal.aborted) {
        return;
      }
      dispatch({ type: 'confirm', chatId, localId, messageId });
      if (session.kind === 'demo') {
        dispatch({
          type: 'event',
          visible: true,
          event: { kind: 'status', chatId, messageId, status: 'read' },
        });
        void abortableDelay(900, signal)
          .then(() =>
            dispatch({
              type: 'event',
              visible: document.visibilityState === 'visible' && document.hasFocus(),
              event: {
                kind: 'message',
                chatId,
                name: '',
                phone: '',
                message: {
                  id: `demo-reply-${crypto.randomUUID()}`,
                  text: 'Сообщение получил! Это демоответ. Подключите GREEN-API, чтобы здесь отвечал ваш собеседник из MAX.',
                  timestamp: Date.now(),
                  direction: 'incoming',
                },
              },
            }),
          )
          .catch(() => {
            // The demo reply is cancelled on logout.
          });
      }
    } catch (error) {
      if (!signal.aborted) {
        dispatch({
          type: 'fail',
          chatId,
          localId,
          error: errorMessage(error),
          uncertain: !(error instanceof ApiError) || error.status === 0 || error.status >= 500,
        });
      }
    } finally {
      sending.current.delete(chatId);
    }
  }

  function sendMessage(chatId: string, text: string): boolean {
    const signal = requests.current?.signal;
    const messageText = text.trim();

    if (
      !signal ||
      signal.aborted ||
      (session.kind === 'live' && (!queueOwner.current || queueOwner.current.signal.aborted)) ||
      connection.status === 'error' ||
      connection.status === 'connecting' ||
      !messageText ||
      messageText.length > MESSAGE_LIMIT ||
      sending.current.has(chatId)
    ) {
      return false;
    }
    sending.current.add(chatId);
    const localId = `local-${crypto.randomUUID()}`;
    dispatch({
      type: 'send',
      chatId,
      message: {
        id: localId,
        text: messageText,
        timestamp: Date.now(),
        direction: 'outgoing',
        status: 'sending',
      },
    });
    void deliverMessage(chatId, messageText, localId, signal);
    return true;
  }

  return {
    state,
    connection,
    openChat,
    sendMessage,
    selectChat: (chatId: string | null) => dispatch({ type: 'select', chatId }),
    reconnect: () => setRetryKey((value) => value + 1),
  };
}
