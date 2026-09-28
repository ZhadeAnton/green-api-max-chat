import { AlertCircle, Check, CheckCheck, Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Message, MessageStatus as Status } from '../types';

interface MessageStatusProps {
  message: Message;
}

const STATUS_LABELS: Record<Status, string> = {
  sending: 'Отправляется',
  queued: 'Принято GREEN-API, ожидает отправки',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
  uncertain: 'Отправка не подтверждена',
};

const STATUS_ICONS = {
  sending: <Clock3 size={12} />,
  queued: <Clock3 size={12} />,
  sent: <Check size={14} />,
  delivered: <CheckCheck size={15} />,
  read: <CheckCheck size={15} />,
  failed: <AlertCircle size={14} />,
  uncertain: <AlertCircle size={14} />,
} satisfies Record<Status, ReactNode>;

export function MessageStatus({ message }: MessageStatusProps) {
  const status = message.status ?? 'queued';
  return (
    <span
      role="img"
      className={`message-status status-${status}`}
      title={STATUS_LABELS[status]}
      aria-label={STATUS_LABELS[status]}
    >
      {STATUS_ICONS[status]}
    </span>
  );
}
