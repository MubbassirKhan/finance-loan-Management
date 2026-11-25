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
    <div className={`bg-white rounded border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Table Container with Horizontal Scroll */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold text-xs tracking-wide uppercase">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3.5 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                >
                  {col.label ?? col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
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
                <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 text-sm ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
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
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
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
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs font-semibold bg-white border border-slate-300 rounded">
              {page}
            </span>
            <button
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
