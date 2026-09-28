import { AlertCircle, ArrowDown, ArrowLeft, MessageCircle, SendHorizontal } from 'lucide-react';
import { type FormEvent, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { formatDay, formatPhone, formatTime, MESSAGE_LIMIT } from '../lib/format';
import type { Chat } from '../types';
import { Avatar } from './Avatar';
import { MessageStatus } from './MessageStatus';

interface ChatThreadProps {
  chat: Chat;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => boolean;
  onBack: () => void;
  disabled: boolean;
}

export function ChatThread({ chat, draft, onDraft, onSend, onBack, disabled }: ChatThreadProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const previousCount = useRef(chat.messages.length);
  const [newBelow, setNewBelow] = useState(false);

  const pending = chat.messages.some((message) => message.status === 'sending');
  const tooLong = draft.length > MESSAGE_LIMIT;

  const scrollToBottom = useCallback(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
    nearBottom.current = true;
    setNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    if (nearBottom.current) {
      scrollToBottom();
    } else if (chat.messages.length > previousCount.current) {
      setNewBelow(true);
    }
    previousCount.current = chat.messages.length;
  }, [chat.messages, scrollToBottom]);

  useLayoutEffect(() => {
    const element = textarea.current;

    if (!element) {
      return;
    }

    element.style.height = draft ? '0px' : '24px';

    if (draft) {
      element.style.height = `${Math.min(Math.max(element.scrollHeight, 24), 120)}px`;
    }
  }, [draft]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || tooLong || pending || disabled) {
      return;
    }
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
          type="button"
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
              if (nearBottom.current) {
                setNewBelow(false);
              }
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
                      <span className="date-label">{day}</span>
                    </div>
                  )}
                  <div className={`message-row ${message.direction}`}>
                    <div className={`message-bubble${failed ? ' message-failed' : ''}`}>
                      <p className="message-text">{message.text}</p>
                      <div className="message-meta">
                        <time dateTime={new Date(message.timestamp).toISOString()}>
                          {formatTime(message.timestamp)}
                        </time>
                        {message.direction === 'outgoing' && <MessageStatus message={message} />}
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
                        type="button"
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
          <button type="button" className="new-below" onClick={scrollToBottom}>
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
