import { initials } from '../lib/format';

interface AvatarProps {
  name: string;
  color?: number;
  small?: boolean;
}

export function Avatar({ name, color = 0, small = false }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`avatar avatar-${color % 5}${small ? ' avatar-small' : ''}`}
    >
      {initials(name)}
    </span>
  );
}
