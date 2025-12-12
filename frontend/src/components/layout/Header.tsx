import { Search, Bell, Plus, Settings, User } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-dark-text">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            placeholder="Pesquisar"
            className="pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
          />
        </div>

        {/* Actions */}
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Novo</span>
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-lg hover:bg-dark-border transition-colors relative">
          <Bell size={20} className="text-dark-muted" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-dark-border transition-colors">
          <Settings size={20} className="text-dark-muted" />
        </button>

        {/* User */}
        <button className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center">
          <User size={16} className="text-white" />
        </button>
      </div>
    </header>
  );
}
