import React from 'react'
import { Clock, Coins } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Dividends() {
  const { t } = useLanguage()

  return (
    <div className="page-stack">
      <PageHeader title={t('dividends.title')} subtitle={t('dividends.subtitle')} />
      <section className="section-card p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50">
          <Coins className="h-8 w-8 text-emerald-700" />
        </div>
        <h2 className="mb-1 text-xl font-bold text-slate-900">{t('dividends.comingSoon')}</h2>
        <p className="mb-3 font-kannada text-slate-600">{t('dividends.comingSoonKn')}</p>
        <p className="mx-auto max-w-md text-sm text-slate-500">{t('dividends.comingSoonDesc')}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Clock className="h-3.5 w-3.5" />
          {t('common.plannedFeature')}
        </div>
      </section>
    </div>
  )
}