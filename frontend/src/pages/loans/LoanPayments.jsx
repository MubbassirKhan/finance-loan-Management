import React from 'react'
import { TrendingUp, Clock } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function LoanPayments() {
  const { t } = useLanguage()
  return (
    <div className="page-stack">
      <PageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />
      <div className="section-card p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 border-2 border-teal-200 mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{t('payments.comingSoon')}</h2>
        <p className="font-kannada text-gray-600 mb-3">{t('payments.comingSoonKn')}</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{t('payments.comingSoonDesc')}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs font-medium">
          <Clock className="w-3.5 h-3.5" />
          {t('common.plannedFeature')}
        </div>
      </div>
    </div>
  )
}
