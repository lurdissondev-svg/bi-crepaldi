import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  variant = 'default',
  size = 'md',
}: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const variantClasses = {
    default: '',
    primary: 'border-primary-500/30 bg-primary-500/5',
    success: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
  };

  return (
    <div className={cn('metric-card', variantClasses[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-muted font-medium">{title}</p>
          <p className={cn('font-bold text-dark-text mt-1', sizeClasses[size])}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-dark-muted mt-1">{subtitle}</p>
          )}
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 mt-2 text-sm',
                isPositive ? 'text-green-500' : 'text-red-500'
              )}
            >
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
              {changeLabel && (
                <span className="text-dark-muted ml-1">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-dark-border rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
