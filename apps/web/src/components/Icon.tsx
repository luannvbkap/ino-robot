/**
 * Biểu tượng Material Symbols — cùng bộ với thiết kế trong giao-dien-mau/.
 * Dùng: <Icon name="smart_toy" size={20} />
 */
export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
