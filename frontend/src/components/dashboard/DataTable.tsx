import { cn } from '../../utils/cn';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  maxRows?: number;
  showRowCount?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  title,
  columns,
  data,
  maxRows,
  showRowCount = true,
  onRowClick,
  emptyMessage = 'Nenhum resultado!',
}: DataTableProps<T>) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  return (
    <div className="card">
      {title && <h3 className="card-header">{title}</h3>}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn('table-header pb-3', col.headerClassName)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-12 h-12 text-dark-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-dark-muted text-sm">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={cn(
                    'border-b border-dark-border/50 hover:bg-dark-border/30 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn('table-cell', col.className)}
                    >
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : String(row[col.key as keyof T] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showRowCount && data.length > 0 && (
        <div className="mt-4 text-right text-xs text-dark-muted">
          {maxRows && data.length > maxRows
            ? `Mostrando ${maxRows} de ${data.length} linhas`
            : `${data.length} linhas`}
        </div>
      )}
    </div>
  );
}
