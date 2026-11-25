import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowUpRight, Banknote, Building2, CheckCircle2,
  Clock3, Eye, FileText, PlusCircle, TrendingUp, UserPlus, Users
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import memberService from '../services/memberService.js'
import policeStationService from '../services/policeStationService.js'

function StatCard({ icon: Icon, label, value, tone, loading, comingSoon, detail }) {
  return (
    <article className={`metric-card ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" />
          ) : comingSoon ? (
            <p className="metric-card-value text-slate-400">—</p>
          ) : (
            <p className="metric-card-value">{new Intl.NumberFormat('en-IN').format(value ?? 0)}</p>
          )}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        {comingSoon ? <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />}
        {loading ? 'Updating records' : comingSoon ? 'Not available yet' : detail}
      </p>
    </article>
  )
}

function QuickAction({ icon: Icon, label, to, tone, navigate }) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex min-h-[88px] w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_1px_2px_rgba(16,43,70,0.05)] transition hover:border-gov-primary/40 hover:bg-blue-50/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary sm:min-h-24 sm:flex-col sm:items-start sm:justify-between sm:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-full sm:justify-between">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-bold leading-snug text-slate-800 sm:flex-none sm:text-sm">
          {label}
        </span>
        <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gov-primary sm:block" aria-hidden="true" />
      </div>
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
      tone: { border: 'border-l-gov-primary', icon: 'bg-blue-50 text-gov-primary' },
      comingSoon: false,
      detail: 'Registered personnel',
    },
    {
      icon: Users,
      label: t('dashboard.activeMembers'),
      value: stats.activeMembers,
      tone: { border: 'border-l-emerald-700', icon: 'bg-emerald-50 text-emerald-800' },
      comingSoon: false,
      detail: 'Currently active',
    },
    {
      icon: Building2,
      label: t('dashboard.totalStations'),
      value: stats.totalStations,
      tone: { border: 'border-l-sky-700', icon: 'bg-sky-50 text-sky-800' },
      comingSoon: false,
      detail: 'Registered units',
    },
    {
      icon: Banknote,
      label: t('dashboard.sanctionedLoans'),
      value: null,
      tone: { border: 'border-l-amber-600', icon: 'bg-amber-50 text-amber-800' },
      comingSoon: true,
    },
    {
      icon: TrendingUp,
      label: t('dashboard.totalRecoveries'),
      value: null,
      tone: { border: 'border-l-teal-700', icon: 'bg-teal-50 text-teal-800' },
      comingSoon: true,
    },
    {
      icon: AlertCircle,
      label: t('dashboard.pendingBalance'),
      value: null,
      tone: { border: 'border-l-rose-700', icon: 'bg-rose-50 text-rose-800' },
      comingSoon: true,
    },
  ]

  const quickActions = [
    { icon: UserPlus, label: t('dashboard.registerMember'), to: '/members/create', tone: 'bg-blue-50 text-gov-primary' },
    { icon: PlusCircle, label: t('dashboard.addStation'), to: '/police-stations/create', tone: 'bg-sky-50 text-sky-800' },
    { icon: Eye, label: t('dashboard.viewMembers'), to: '/members', tone: 'bg-emerald-50 text-emerald-800' },
    { icon: Building2, label: t('dashboard.viewStations'), to: '/police-stations', tone: 'bg-amber-50 text-amber-800' },
    { icon: FileText, label: t('dashboard.feeStructure'), to: '/membership-fees', tone: 'bg-teal-50 text-teal-800' },
  ]

  return (
    <div className="page-stack">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => navigate('/members/create')}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded bg-gov-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-gov-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t('dashboard.registerMember')}
          </button>
        }
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <section aria-labelledby="overview-heading" className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-gov-navy px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/15 bg-white/10 text-amber-300">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="overview-heading" className="text-base font-bold leading-tight sm:text-lg">{t('dashboard.systemOverview')}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-200">Membership and police-station records at a glance.</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-sm border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-100">
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-300' : error ? 'bg-red-300' : 'bg-emerald-300'}`} />
            {loading ? 'Updating records' : error ? 'Service needs attention' : 'Records connected'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} loading={loading} />
          ))}
        </div>
      </section>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-gov-primary">Common tasks</p>
            <h2 id="quick-actions-heading" className="mt-0.5 text-base font-bold text-gov-navy">{t('dashboard.quickActions')}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickActions.map((action) => (
            <QuickAction key={action.to} {...action} navigate={navigate} />
          ))}
        </div>
      </section>

      <section aria-labelledby="activity-heading" className="section-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase text-gov-primary">Audit overview</p>
            <h2 id="activity-heading" className="mt-0.5 text-base font-bold text-gov-navy">{t('dashboard.recentActivity')}</h2>
          </div>
          <Clock3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>
        <div className="flex min-h-28 items-center gap-3 px-4 py-5 text-slate-500 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-relaxed">{t('dashboard.recentActivityPlaceholder')}</p>
        </div>
      </section>
    </div>
  )
}
