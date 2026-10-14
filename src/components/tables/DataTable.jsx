import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/format'
import { EmptyState } from '../ui/States'

/**
 * Generic responsive table.
 * - `columns`: { key, header, render?, sortable?, align?, className? }
 * - On small screens a stacked card layout is rendered instead of a squeezed table.
 */
export const DataTable = ({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? index,
  sort = null,
  onSort,
  loading,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your search or filters.',
  emptyIcon,
  onRowClick,
  mobileCard,
  page,
  pageCount,
  onPageChange,
  pageSize,
  total,
}) => {
  const SortIcon = ({ column }) => {
    if (!onSort || !column.sortable) return null
    const active = sort?.key === column.key
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
    return sort.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
    )
  }

  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div>
      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-app-border bg-slate-50/70">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-wide text-slate-600 uppercase',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.className,
                  )}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 transition hover:text-brand-700',
                        column.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {column.header}
                      <SortIcon column={column} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-brand-50/40',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle text-slate-700',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.cellClassName,
                    )}
                  >
                    {column.render ? column.render(row, index) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-app-border md:hidden">
        {rows.map((row, index) => (
          <div
            key={rowKey(row, index)}
            className={cn('p-4', onRowClick && 'cursor-pointer active:bg-brand-50/40')}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }
                : undefined
            }
          >
            {mobileCard ? mobileCard(row) : null}
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          compact
        />
      ) : null}

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border px-4 py-3">
          <p className="text-xs text-app-muted">
            Showing <span className="font-medium text-slate-700">{from}</span>-
            <span className="font-medium text-slate-700">{to}</span> of{' '}
            <span className="font-medium text-slate-700">{total}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-app-border px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Prev
            </button>
            <span className="px-2 text-xs font-medium text-slate-700">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === pageCount}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-app-border px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DataTable