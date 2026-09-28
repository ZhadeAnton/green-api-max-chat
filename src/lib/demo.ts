import type { Message } from '../types';
import type { ChatState } from './chat-state';

export function createDemoState(): ChatState {
  const now = Date.now();
  const message = (
    id: string,
    text: string,
    direction: Message['direction'],
    minutes: number,
  ): Message => ({
    id,
    text,
    direction,
    timestamp: now - minutes * 60_000,
    ...(direction === 'outgoing' ? { status: 'read' as const } : {}),
  });
  return {
    activeId: 'demo-alex',
    earlyStatuses: {},
    chats: [
      {
        id: 'demo-alex',
        name: 'Александра Морозова',
        phone: '79000000001',
        color: 0,
        unread: 0,
        messages: [
          message('d1', 'Привет! Получилось подключить чат? 👋', 'incoming', 12),
          message('d2', 'Да, всё готово! Теперь можно общаться прямо здесь.', 'outgoing', 11),
          message('d3', 'Здорово. Люблю, когда всё просто и под рукой.', 'incoming', 10),
          message('d4', 'Только ты, собеседник и ваши сообщения ✨', 'outgoing', 9),
          message(
            'd5',
            'Попробуй написать что-нибудь внизу. Это демонстрационный чат — реальным людям сообщения не отправляются.',
            'incoming',
            8,
          ),
        ],
      },
      {
        id: 'demo-misha',
        name: 'Михаил Соколов',
        phone: '79000000002',
        color: 1,
        unread: 1,
        messages: [message('m1', 'Привет! Созвонимся после обеда?', 'incoming', 32)],
      },
      {
        id: 'demo-anna',
        name: 'Анна Лебедева',
        phone: '79000000003',
        color: 2,
        unread: 0,
        messages: [message('a1', 'Спасибо, хорошего дня! ☀️', 'outgoing', 65)],
      },
    ],
  };
}
