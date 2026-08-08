// Neriva mark: a rounded lightning bolt. Lightweight is the brand.
export function BoltMark({ size = 28, color = '#cc3d47' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18.5 3.5 L7.5 18 h6.5 L12.5 28.5 L24.5 13 h-7 z"
        fill={color}
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NerivaLogo({
  size = 28,
  color = '#cc3d47',
  textColor = 'currentColor',
  withWordmark = true,
}: {
  size?: number;
  color?: string;
  textColor?: string;
  withWordmark?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <BoltMark size={size} color={color} />
      {withWordmark ? (
        <span
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontWeight: 700,
            fontSize: size * 0.78,
            letterSpacing: '-0.03em',
            color: textColor,
            lineHeight: 1,
          }}
        >
          neriva
        </span>
      ) : null}
    </span>
  );
}
