export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="psymark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b74f2" />
          <stop offset="1" stopColor="#1f4fd0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" fill="url(#psymark)" />
      <rect x="241" y="150" width="30" height="238" rx="10" fill="#ffffff" />
      <path
        d="M150 150 V 210 C150 268 198 300 256 300 C 314 300 362 268 362 210 V 150"
        fill="none"
        stroke="#ffffff"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <rect x="196" y="372" width="120" height="26" rx="10" fill="#ffffff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">
        <span className="logo-psy">Psy</span>Stat
      </span>
    </span>
  );
}
