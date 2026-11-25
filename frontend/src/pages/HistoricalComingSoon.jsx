import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function HistoricalComingSoon() {
  const { t, language } = useLanguage()
  const { admin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal top bar */}
      <header className="bg-gov-navy text-white px-6 py-3 flex items-center justify-between shadow">
        <div>
          <p className="text-xs text-blue-200 font-kannada">ಪೊಲೀಸ್ ಪತ್ತಿನ ಸಹಕಾರಿ ಸಂಘ ನಿಯಮಿತ</p>
          <p className="text-sm font-semibold">Membership and Fund Management System</p>
        </div>
        {admin && (
          <span className="text-xs text-blue-200">{admin.username}</span>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 border-2 border-blue-200 mx-auto mb-6">
            <Clock className="w-10 h-10 text-gov-primary" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {t('historical.title')}
          </h1>
          <p className="font-kannada text-lg text-gray-600 mb-4">
            {t('historical.titleKn')}
          </p>

          {/* Divider */}
          <div className="border-t border-gray-200 my-5" />

          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed mb-2">
            {t('historical.subtitle')}
          </p>
          <p className="text-gray-500 text-xs leading-relaxed">
            {t('historical.notice')}
          </p>

          {/* Period badge */}
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm font-medium">
            <Clock className="w-4 h-4" />
            {t('historical.period')}
          </div>

          {/* Back button */}
          <div className="mt-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gov-primary text-white rounded text-sm font-medium hover:bg-gov-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('historical.backToCurrent')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
