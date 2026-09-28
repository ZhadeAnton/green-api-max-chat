export const MESSAGE_LIMIT = 4000;

export function normalizePhone(value: string): string {
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) {
    throw new Error('Введите номер телефона, например +7 900 123-45-67.');
  }
  let digits = value.replace(/\D/g, '');
  if (/^8\d{10}$/.test(digits)) {
    digits = `7${digits.slice(1)}`;
  }
  if (!/^(7\d{10}|375\d{9})$/.test(digits)) {
    throw new Error(
      'Поиск в MAX поддерживает номера России (+7) и Беларуси (+375). Проверьте количество цифр.',
    );
  }
  return digits;
}

export function formatPhone(phone: string): string {
  if (/^7\d{10}$/.test(phone)) {
    return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  if (/^375\d{9}$/.test(phone)) {
    return `+375 ${phone.slice(3, 5)} ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10)}`;
  }
  return phone ? `+${phone}` : '';
}

export const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(timestamp);

export function formatDay(timestamp: number): string {
  const date = new Date(timestamp);
  if (date.toDateString() === new Date().toDateString()) {
    return 'Сегодня';
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  );
}

export function initials(name: string): string {
  if (/^[+\d\s()-]+$/.test(name)) {
    return name.replace(/\D/g, '').slice(-2);
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте ещё раз.';
