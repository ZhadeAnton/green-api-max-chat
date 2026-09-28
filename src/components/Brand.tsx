export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <svg className="brand-icon" aria-hidden="true" viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="15" fill="currentColor" />
        <path d="M35 24c0 7.5-5 12-12 12h-7l-4 3V24c0-7 5-12 12-12s11 5 11 12Z" fill="white" />
        <path
          d="m18 25 4-5 4 5 4-5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <span>
          MAX<span className="brand-light"> Chat</span>
        </span>
      )}
    </div>
  );
}
