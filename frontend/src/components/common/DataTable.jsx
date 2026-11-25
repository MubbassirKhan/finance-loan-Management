import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  total = 0,
  page = 1,
  size = 20,
  totalPages: totalPagesProp,  // allow caller to supply pre-computed totalPages
  onPageChange,
  emptyMessage,
  className = '',
}) => {
  const { t } = useLanguage();
  // Support both computed and pre-supplied totalPages
  const totalPages = totalPagesProp ?? Math.max(1, Math.ceil(total / size));

  return (
    <div className={`min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="table-scroll">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-amber-400 bg-gov-navy text-[11px] font-bold uppercase text-white">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`whitespace-nowrap px-4 py-4 leading-tight tracking-wide ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                >
                  {col.label ?? col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-7 h-7 border-3 border-gov-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">{t('common.loading', 'Loading data...')}</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Inbox className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-medium">{emptyMessage || t('common.noRecords', 'No records found.')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx} className="group transition-colors even:bg-slate-50/70 hover:bg-blue-50/80">
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3.5 align-middle text-sm text-slate-700 transition-colors group-hover:text-slate-900 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, rowIdx) : row[col.key ?? col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row">
          <div>
            <span>
              {t('common.total', 'Total')}: <strong className="font-semibold text-slate-900">{total}</strong> {t('common.records', 'records')}
            </span>
            <span className="mx-2 text-slate-300">|</span>
            <span>
              {t('common.page', 'Page')} <strong className="font-semibold text-slate-900">{page}</strong> {t('common.of', 'of')}{' '}
              <strong className="font-semibold text-slate-900">{totalPages}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange && onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-gov-primary hover:bg-blue-50 hover:text-gov-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-gov-primary bg-gov-primary px-2 text-xs font-bold text-white">
              {page}
            </span>
            <button
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-gov-primary hover:bg-blue-50 hover:text-gov-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
