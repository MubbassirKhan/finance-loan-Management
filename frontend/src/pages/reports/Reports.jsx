import React from 'react'
import { BarChart2, Clock } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

const PLANNED_REPORTS = [
  'reports.membershipSummary',
  'reports.loanStatement',
  'reports.recoveryReport',
  'reports.balanceSheet',
  'reports.stationWise',
  'reports.annualReport',
]

export default function Reports() {
  const { t } = useLanguage()
  return (
    <div className="p-6 space-y-5">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div className="section-card p-8 text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 border-2 border-indigo-200 mx-auto mb-4">
          <BarChart2 className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{t('reports.comingSoon')}</h2>
        <p className="font-kannada text-gray-600 mb-3">{t('reports.comingSoonKn')}</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{t('reports.comingSoonDesc')}</p>
      </div>

      {/* Planned report categories */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('reports.plannedReports')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLANNED_REPORTS.map((key) => (
          <div key={key} className="section-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{t(key)}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs font-medium flex-shrink-0">
              <Clock className="w-3 h-3" />
              {t('common.soon')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
