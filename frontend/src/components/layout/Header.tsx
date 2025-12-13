import { StatusIndicator } from '../StatusIndicator';
import { SyncTimer } from '../SyncTimer';
import { ThemeToggle } from '../ThemeToggle';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-primary)] flex items-center justify-between px-6 sticky top-0 z-30 backdrop-blur-sm bg-opacity-90">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync Timer */}
        <SyncTimer />

        {/* System Status */}
        <StatusIndicator />

        {/* Divider */}
        <div className="w-px h-6 bg-[var(--color-border-primary)]" />

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
