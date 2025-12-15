import { formatCurrency } from '../../utils/format';
import { cn } from '../../utils/cn';

interface MetricCardProps {
  value: number | string;
  label: string;
  format?: 'number' | 'currency' | 'percentage';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

function formatValue(value: number | string, format: string = 'number'): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percentage':
      return `${value.toFixed(2)}%`;
    default:
      return value.toLocaleString('pt-BR');
  }
}

const sizeClasses = {
  sm: {
    value: 'text-2xl',
    label: 'text-xs',
    padding: 'p-3',
  },
  md: {
    value: 'text-3xl',
    label: 'text-sm',
    padding: 'p-4',
  },
  lg: {
    value: 'text-4xl',
    label: 'text-base',
    padding: 'p-6',
  },
};

export function MetricCard({
  value,
  label,
  format = 'number',
  size = 'md',
  className,
  onClick,
}: MetricCardProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-xl',
        'flex flex-col items-center justify-center text-center',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:border-[var(--color-accent)] hover:shadow-lg',
        sizes.padding,
        className
      )}
      onClick={onClick}
    >
      <p className={cn('font-bold text-[var(--color-text-primary)]', sizes.value)}>
        {formatValue(value, format)}
      </p>
      <p className={cn('text-[var(--color-text-muted)] mt-1', sizes.label)}>{label}</p>
    </div>
  );
}

// Section Header component like Metabase
interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border-subtle)]',
        className
      )}
    >
      {title}
    </h2>
  );
}

// Metrics Row component for horizontal metric display
interface MetricsRowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricsRow({ title, children, className }: MetricsRowProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && <SectionHeader title={title} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {children}
      </div>
    </div>
  );
}
