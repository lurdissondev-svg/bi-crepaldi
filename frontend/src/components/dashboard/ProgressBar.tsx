import { cn } from '../../utils/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  color = 'primary',
  size = 'md',
  className,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-400',
    success: 'bg-gradient-to-r from-green-500 to-green-400',
    warning: 'bg-gradient-to-r from-yellow-500 to-yellow-400',
    danger: 'bg-gradient-to-r from-red-500 to-red-400',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-dark-muted">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium text-dark-text">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={cn('progress-bar', sizeClasses[size])}>
        <div
          className={cn('progress-bar-fill', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1 text-xs text-dark-muted">
        <span>0</span>
        <span>Meta {max}%</span>
      </div>
    </div>
  );
}
