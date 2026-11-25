import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, AlertTriangle } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function NotFound() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 border-2 border-red-200 mx-auto mb-5">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-5xl font-bold text-gov-navy mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">{t('notFound.title')}</h2>
        <p className="text-sm text-gray-500 mb-6">{t('notFound.message')}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gov-primary text-white rounded text-sm font-medium hover:bg-gov-secondary transition-colors"
        >
          <Home className="w-4 h-4" />
          {t('notFound.backHome')}
        </button>
      </div>
    </div>
  )
}
