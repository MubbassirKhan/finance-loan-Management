import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Building2, Banknote, TrendingUp,
  AlertCircle, UserPlus, PlusCircle, Eye, FileText
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import memberService from '../services/memberService.js'
import policeStationService from '../services/policeStationService.js'

// Stat card component
function StatCard({ icon: Icon, label, value, color, loading, comingSoon }) {
  return (
    <div className="section-card p-5 flex items-start gap-4">
      <div className={`p-3 rounded ${color} flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        {loading ? (
          <div className="mt-1 h-6 w-16 bg-gray-200 animate-pulse rounded" />
        ) : comingSoon ? (
          <p className="mt-1 text-sm text-gray-400 italic">Coming Soon</p>
        ) : (
          <p className="mt-1 text-2xl font-bold text-gray-800">{value}</p>
        )}
      </div>
    </div>
  )
}

// Quick action card
function QuickAction({ icon: Icon, label, to, color, navigate }) {
  return (
    <button
      onClick={() => navigate(to)}
      className="section-card p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer w-full"
    >
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </button>
  )
}

export default function Dashboard() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalMembers: null,
    activeMembers: null,
    totalStations: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        // Fetch all three in parallel – use size=1 since we only need total_count
        const [membersRes, activeMembersRes, stationsRes] = await Promise.all([
          memberService.getMembers({ page: 1, size: 1 }),
          memberService.getMembers({ page: 1, size: 1, status: 'Active' }),
          policeStationService.getStations({ page: 1, size: 1 }),
        ])
        setStats({
          totalMembers: membersRes.total_count ?? membersRes.total ?? 0,
          activeMembers: activeMembersRes.total_count ?? activeMembersRes.total ?? 0,
          totalStations: stationsRes.total_count ?? stationsRes.total ?? 0,
        })
      } catch (err) {
        setError(err.message || 'Failed to load dashboard statistics.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      icon: Users,
      label: t('dashboard.totalMembers'),
      value: stats.totalMembers,
      color: 'bg-gov-primary',
      comingSoon: false,
    },
    {
      icon: Users,
      label: t('dashboard.activeMembers'),
      value: stats.activeMembers,
      color: 'bg-gov-success',
      comingSoon: false,
    },
    {
      icon: Building2,
      label: t('dashboard.totalStations'),
      value: stats.totalStations,
      color: 'bg-blue-600',
      comingSoon: false,
    },
    {
      icon: Banknote,
      label: t('dashboard.sanctionedLoans'),
      value: null,
      color: 'bg-purple-600',
      comingSoon: true,
    },
    {
      icon: TrendingUp,
      label: t('dashboard.totalRecoveries'),
      value: null,
      color: 'bg-teal-600',
      comingSoon: true,
    },
    {
      icon: AlertCircle,
      label: t('dashboard.pendingBalance'),
      value: null,
      color: 'bg-orange-500',
      comingSoon: true,
    },
  ]

  const quickActions = [
    { icon: UserPlus,   label: t('dashboard.registerMember'),  to: '/members/create',         color: 'bg-gov-primary' },
    { icon: PlusCircle, label: t('dashboard.addStation'),       to: '/police-stations/create', color: 'bg-blue-600'    },
    { icon: Eye,        label: t('dashboard.viewMembers'),      to: '/members',                color: 'bg-gov-success' },
    { icon: Building2,  label: t('dashboard.viewStations'),     to: '/police-stations',        color: 'bg-indigo-600'  },
    { icon: FileText,   label: t('dashboard.feeStructure'),     to: '/membership-fees',        color: 'bg-teal-600'    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Statistics Grid */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('dashboard.systemOverview')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card, i) => (
            <StatCard key={i} {...card} loading={loading} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((action, i) => (
            <QuickAction key={i} {...action} navigate={navigate} />
          ))}
        </div>
      </section>

      {/* Recent Activity placeholder */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('dashboard.recentActivity')}
        </h2>
        <div className="section-card p-8 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('dashboard.recentActivityPlaceholder')}</p>
        </div>
      </section>
    </div>
  )
}
