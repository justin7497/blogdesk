export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className ?? "logo-mark"}
      aria-hidden
    >
      <rect width="40" height="40" rx="11" fill="#163224" />
      <path
        d="M8 22.5 20 12l12 10.5"
        fill="none"
        stroke="#d8f3e0"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 21.5h16v10.5H12z" fill="#3f7d55" />
      <path d="M17.2 32V25h5.6v7" fill="#163224" />
      <circle cx="20" cy="18.2" r="1.2" fill="#f4faf6" />
    </svg>
  );
}
