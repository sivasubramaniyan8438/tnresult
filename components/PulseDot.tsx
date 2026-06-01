import { cn } from "@/lib/cn";

export function PulseDot({
  className,
  color = "var(--accent-live)",
  size = 10,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("relative inline-flex pulse-ring", className)}
      style={{ width: size, height: size, color, borderRadius: 9999 }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 ${size * 1.2}px ${color}` }}
      />
    </span>
  );
}
