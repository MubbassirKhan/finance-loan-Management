import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Banknote, Building2, CheckCircle2,
  Clock3, Eye, FileText, PlusCircle, TrendingUp, UserPlus, Users
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import memberService from '../services/memberService.js'
import loanService from '../services/loanService.js'
import policeStationService from '../services/policeStationService.js'

const formatCurrency = (value, locale) => new Intl.NumberFormat(locale === 'kn-IN' ? 'en-IN' : locale, {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format(Number(value) || 0)

function StatCard({ icon: Icon, label, value, tone, loading, currency = false, detail, locale, t }) {
  const displayValue = currency
    ? formatCurrency(value, 'en-IN')
    : new Intl.NumberFormat(locale).format(value ?? 0)

  return (
    <article className={`metric-card ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
          {loading ? (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" />
          ) : (
            <p
              className={`metric-card-value${currency ? ' metric-card-currency' : ''}`}
              title={currency ? displayValue : undefined}
            >
              {displayValue}
            </p>
          )}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
        {loading ? t('dashboard.updatingRecords') : detail}
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
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-full sm:gap-2 sm:justify-between">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-bold leading-snug text-slate-800 sm:text-sm">
          {label}
        </span>
        <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gov-primary sm:block" aria-hidden="true" />
      </div>
    </button>
  )
}

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN'

  const [stats, setStats] = useState({
    totalMembers: null,
    activeMembers: null,
    totalStations: null,
    sanctionedLoans: null,
    totalRecoveries: null,
    pendingBalance: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scheduleAlerts, setScheduleAlerts] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const [membersRes, activeMembersRes, stationsRes, loans] = await Promise.all([
          memberService.getMembers({ page: 1, size: 1 }),
          memberService.getMembers({ page: 1, size: 1, status: 'Active' }),
          policeStationService.getStations({ page: 1, size: 1 }),
          loanService.getAllLoans(),
        ])
        setStats({
          totalMembers: membersRes.total_count ?? membersRes.total ?? 0,
          activeMembers: activeMembersRes.total_count ?? activeMembersRes.total ?? 0,
          totalStations: stationsRes.total_count ?? stationsRes.total ?? 0,
          sanctionedLoans: loans.reduce((total, loan) => total + Number(loan.sanction_amount ?? 0), 0),
          totalRecoveries: loans.reduce((total, loan) => total + Number(loan.total_recovered ?? 0), 0),
          pendingBalance: loans.reduce((total, loan) => total + Number(loan.outstanding_balance ?? 0), 0),
        })
      } catch {
        setError(t('dashboard.loadDashboardError'))
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [language])

  useEffect(() => {
    let active = true
    const fetchScheduleAlerts = async () => {
      try {
        const month = currentMonth()
        const [due, missing, waiting] = await Promise.all([
          loanService.getMonthlySchedules({ month, schedule_status: 'Due', page: 1, size: 1 }),
          loanService.getMonthlySchedules({ month, schedule_status: 'Missing', page: 1, size: 1 }),
          loanService.getMonthlySchedules({ month, schedule_status: 'Waiting', page: 1, size: 1 }),
        ])
        if (active) {
          setScheduleAlerts([
            { key: 'due', label: t('dashboard.installmentsDue'), count: due.total ?? due.items?.length ?? 0 },
            { key: 'missing', label: t('dashboard.missingInstallmentRecords'), count: missing.total ?? missing.items?.length ?? 0 },
            { key: 'waiting', label: t('dashboard.waitingForEarlierInstallments'), count: waiting.total ?? waiting.items?.length ?? 0 },
          ])
        }
      } catch {
        if (active) setScheduleError(t('dashboard.loadPaymentAlertsError'))
      } finally {
        if (active) setScheduleLoading(false)
      }
    }
    fetchScheduleAlerts()
    return () => { active = false }
  }, [language])

  const sanctionedAmount = Number(stats.sanctionedLoans) || 0
  const recoveredAmount = Number(stats.totalRecoveries) || 0
  const recoveryPercent = sanctionedAmount > 0
    ? Math.min(100, (recoveredAmount / sanctionedAmount) * 100)
    : 0
  const activeAlerts = scheduleAlerts.filter((alert) => alert.count > 0)

  const statCards = [
    {
      icon: Users,
      label: t('dashboard.totalMembers'),
      value: stats.totalMembers,
      tone: { border: 'border-l-gov-primary', icon: 'bg-blue-50 text-gov-primary' },
      comingSoon: false,
      detail: t('dashboard.registeredPersonnel'),
    },
    {
      icon: Users,
      label: t('dashboard.activeMembers'),
      value: stats.activeMembers,
      tone: { border: 'border-l-emerald-700', icon: 'bg-emerald-50 text-emerald-800' },
      comingSoon: false,
      detail: t('dashboard.currentlyActive'),
    },
    {
      icon: Building2,
      label: t('dashboard.totalStations'),
      value: stats.totalStations,
      tone: { border: 'border-l-sky-700', icon: 'bg-sky-50 text-sky-800' },
      comingSoon: false,
      detail: t('dashboard.registeredUnits'),
    },
    {
      icon: Banknote,
      label: t('dashboard.sanctionedLoans'),
      value: stats.sanctionedLoans,
      tone: { border: 'border-l-amber-600', icon: 'bg-amber-50 text-amber-800' },
      currency: true,
      detail: t('dashboard.totalPrincipalSanctioned'),
    },
    {
      icon: TrendingUp,
      label: t('dashboard.totalRecoveries'),
      value: stats.totalRecoveries,
      tone: { border: 'border-l-teal-700', icon: 'bg-teal-50 text-teal-800' },
      currency: true,
      detail: t('dashboard.principalRecovered'),
    },
    {
      icon: AlertCircle,
      label: t('dashboard.pendingBalance'),
      value: stats.pendingBalance,
      tone: { border: 'border-l-rose-700', icon: 'bg-rose-50 text-rose-800' },
      currency: true,
      detail: t('dashboard.outstandingPrincipal'),
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
        eyebrow={t('dashboard.eyebrow')}
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
              <p className="mt-1 text-xs leading-relaxed text-slate-200">{t('dashboard.overviewDescription')}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-sm border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-100">
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-300' : error ? 'bg-red-300' : 'bg-emerald-300'}`} />
            {loading ? t('dashboard.updatingRecords') : error ? t('dashboard.serviceNeedsAttention') : t('dashboard.recordsConnected')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 xl:grid-cols-6">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} loading={loading} locale={locale} t={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-gov-primary">{t('dashboard.commonTasks')}</p>
            <h2 id="quick-actions-heading" className="mt-0.5 text-base font-bold text-gov-navy">{t('dashboard.quickActions')}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickActions.map((action) => (
            <QuickAction key={action.to} {...action} navigate={navigate} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="repayment-progress-heading" className="section-card min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-gov-primary">{t('dashboard.loanPortfolio')}</p>
              <h2 id="repayment-progress-heading" className="mt-0.5 text-base font-bold text-gov-navy">{t('dashboard.repaymentProgress')}</h2>
            </div>
            <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          </div>
          {loading ? (
            <div className="mt-5 h-16 animate-pulse rounded bg-slate-100" aria-label={t('dashboard.loadingRepaymentProgress')} />
          ) : (
            <>
              <div className="mt-5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-slate-600">{t('dashboard.principalRecovered')}</span>
                <span className="text-lg font-bold tabular-nums text-gov-navy">{recoveryPercent.toFixed(1)}%</span>
              </div>
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={t('dashboard.principalRecovered')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Number(recoveryPercent.toFixed(1))}
              >
                <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-500" style={{ width: `${recoveryPercent}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{t('dashboard.recovered')}</p>
                  <p className="mt-1 truncate text-sm font-bold text-emerald-800" title={formatCurrency(recoveredAmount, locale)}>{formatCurrency(recoveredAmount, locale)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{t('dashboard.remaining')}</p>
                  <p className="mt-1 truncate text-sm font-bold text-gov-navy" title={formatCurrency(stats.pendingBalance, locale)}>{formatCurrency(stats.pendingBalance, locale)}</p>
                </div>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="payment-alerts-heading" className="section-card min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-gov-primary">{t('dashboard.currentMonth')}</p>
              <h2 id="payment-alerts-heading" className="mt-0.5 text-base font-bold text-gov-navy">{t('dashboard.paymentAlerts')}</h2>
            </div>
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          </div>
          {scheduleLoading ? (
            <div className="mt-5 h-16 animate-pulse rounded bg-slate-100" aria-label={t('dashboard.loadingPaymentAlerts')} />
          ) : scheduleError ? (
            <p role="alert" className="mt-4 text-sm text-rose-700">{scheduleError}</p>
          ) : (
            <>
              {activeAlerts.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {activeAlerts.map((alert) => (
                    <li key={alert.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                        <span className="truncate">{alert.label}</span>
                      </span>
                      <span className="shrink-0 rounded bg-amber-50 px-2 py-1 text-xs font-bold tabular-nums text-amber-900">{alert.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('dashboard.noPaymentIssues')}
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate('/schedules')}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-gov-primary hover:text-gov-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary"
              >
                {t('dashboard.reviewSchedules')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="activity-heading" className="section-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase text-gov-primary">{t('dashboard.auditOverview')}</p>
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
