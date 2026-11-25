import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, KeyRound, Info } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/common/Button.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function InfoRow({ label, value }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-gray-900">{value}</dd>
    </div>
  )
}

export default function Settings() {
  const { t }    = useLanguage()
  const { admin } = useAuth()
  const navigate  = useNavigate()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Account Information */}
      <div className="section-card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-gov-primary" />
          <h3 className="text-sm font-semibold text-gov-primary uppercase tracking-wide">
            {t('settings.accountInfo')}
          </h3>
        </div>
        <dl className="px-5 py-1">
          <InfoRow label={t('settings.username')}      value={admin?.username || '—'} />
          <InfoRow label={t('settings.role')}          value="Administrator" />
          <InfoRow label={t('settings.systemVersion')} value="1.0.0" />
          <InfoRow label={t('settings.database')}      value="financeDB (PostgreSQL 18)" />
        </dl>
      </div>

      {/* Security */}
      <div className="section-card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gov-primary" />
          <h3 className="text-sm font-semibold text-gov-primary uppercase tracking-wide">
            {t('settings.security')}
          </h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">{t('settings.securityNote')}</p>
          <Button
            variant="outline"
            icon={<KeyRound className="w-4 h-4" />}
            onClick={() => navigate('/change-password')}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </div>

      {/* System Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{t('settings.notice')}</span>
      </div>
    </div>
  )
}
