import { initials } from '../lib/format';

export function Avatar({
  name,
  color = 0,
  small = false,
}: {
  name: string;
  color?: number;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`avatar avatar-${color % 5}${small ? ' avatar-small' : ''}`}
    >
      {initials(name)}
    </span>
  );
}
