type Props = { left: number };

function magnetLine(left: number): string {
  if (left <= 0) return "ניצלתם את כל המגנטים, תודה שצילמתם!";
  if (left === 1) return "נשאר לכם מגנט אחד";
  return `נשארו לכם ${left} מגנטים`;
}

function MagnetGlyph() {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="25"
        height="31"
        rx="5"
        fill="#9ADCFF"
        stroke="#1C1416"
        strokeWidth="2"
      />
      <rect
        x="5.5"
        y="5"
        width="17"
        height="16"
        rx="2.5"
        fill="#FBF6F1"
        stroke="#1C1416"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MagnetMeter({ left }: Props) {
  const count = Math.max(0, left);
  const shown = Math.min(count, 10);

  return (
    <div>
      {shown > 0 ? (
        <ul className="guest-magnets" aria-hidden="true">
          {Array.from({ length: shown }, (_, index) => (
            <li key={index}>
              <MagnetGlyph />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-base text-ink">{magnetLine(count)}</p>
    </div>
  );
}
