interface Props {
  size?: number;
  withWordmark?: boolean;
  subtitle?: string;
}

export default function BrandMark({
  size = 56,
  withWordmark = false,
  subtitle,
}: Props) {
  return (
    <div className={`brand-lockup${withWordmark ? ' has-wordmark' : ''}`}>
      <div className="brand-mark" style={{ width: size, height: size }}>
        <svg
          aria-hidden="true"
          fill="none"
          viewBox="0 0 92 92"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="69" cy="22" fill="#d39f72" opacity="0.95" r="6" />
          <circle cx="58" cy="15" fill="#efd7bf" opacity="0.92" r="4" />
          <circle cx="76" cy="34" fill="#7b9d95" opacity="0.9" r="4.5" />
          <path
            d="M16 56C16 50.8 20.2 46.6 25.4 46.6H39.2C43.6 46.6 47.6 44.5 50.1 40.9L53.1 36.6C54.7 34.2 58.4 34.6 59.5 37.2L65.6 51.5C66.4 53.4 68.2 54.6 70.2 54.6H73.9C78.4 54.6 82 58.2 82 62.7V65.4C82 70.9 77.5 75.4 72 75.4H26C20.5 75.4 16 70.9 16 65.4V56Z"
            fill="#4f766d"
          />
          <path
            d="M40.8 46.8L46.8 38.6C47.8 37.2 49.8 37.5 50.5 39L55.7 50.7"
            opacity="0.95"
            stroke="#FCFAF6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.6"
          />
          <circle cx="33" cy="61.5" fill="#FCFAF6" opacity="0.95" r="4.8" />
          <circle cx="66" cy="61.5" fill="#FCFAF6" opacity="0.95" r="4.8" />
        </svg>
      </div>
      {withWordmark ? (
        <div className="brand-wordmark">
          <strong>喜颂</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
