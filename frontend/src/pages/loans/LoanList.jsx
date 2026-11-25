import React from 'react'
import { Banknote, Clock } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

function PlaceholderColumn({ label }) {
  return (
    <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 font-medium uppercase tracking-wide">
      {label}
    </div>
  )
}

export default function LoanList() {
  const { t } = useLanguage()

  return (
    <div className="p-6 space-y-5">
      <PageHeader title={t('loans.title')} subtitle={t('loans.subtitle')} />

      {/* Coming Soon banner */}
      <div className="section-card p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 border-2 border-purple-200 mx-auto mb-4">
          <Banknote className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{t('loans.comingSoon')}</h2>
        <p className="font-kannada text-gray-600 mb-3">{t('loans.comingSoonKn')}</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{t('loans.comingSoonDesc')}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs font-medium">
          <Clock className="w-3.5 h-3.5" />
          {t('common.plannedFeature')}
        </div>
      </div>

      {/* Planned table structure preview */}
      <div className="section-card overflow-hidden opacity-50">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t('loans.plannedColumns')}
        </div>
        {[
          t('loans.loanId'), t('members.kgid'), t('loans.loanType'),
          t('loans.sanctionDate'), t('loans.sanctionAmount'), t('loans.monthlyPrincipal'),
          t('loans.totalInstallments'), t('common.status'),
        ].map((col) => <PlaceholderColumn key={col} label={col} />)}
      </div>
    </div>
  )
}
