import { cn } from '../../utils/cn';

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  value,
  label,
  sublabel,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div className={cn('text-center p-4', className)}>
      <p className={cn('text-4xl font-bold text-[var(--color-text-primary)]', valueClassName)}>
        {value}
      </p>
      <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{label}</p>
      {sublabel && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
