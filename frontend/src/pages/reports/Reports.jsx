import React, { useEffect, useState } from 'react'
import {
  Activity, Banknote, CalendarDays, FileSpreadsheet, FileText, Landmark,
  Users, WalletCards,
} from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import reportService from '../../services/reportService.js'
import reportExportService from '../../services/reportExportService.js'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 15 }, (_, index) => currentYear - index)

function formatCurrency(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(locale).format(Number(value) || 0)
}

function getPeriodLabel(period, month, year, locale) {
  if (month) return period.replace('W', 'Week ')
  const [periodYear, periodMonth] = period.split('-').map(Number)
  return new Date(periodYear || year, (periodMonth || 1) - 1, 1).toLocaleDateString(locale, { month: 'short' })
}

function SummaryCard({ icon: Icon, label, value, detail, amount = false, locale, tone }) {
  const shownValue = amount ? formatCurrency(value, locale) : formatNumber(value, locale)
  return (
    <article className="min-w-0 rounded-md border border-slate-200 border-t-2 border-t-slate-300 bg-white p-4 shadow-[0_1px_2px_rgba(16,43,70,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
          <p className={`mt-2 truncate text-xl font-bold tabular-nums text-gov-navy sm:text-2xl ${amount ? 'tracking-normal' : ''}`} title={amount ? shownValue : undefined}>
            {shownValue}
          </p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{detail}</p>
    </article>
  )
}

function TrendChart({ title, description, data, month, year, locale, series, formatter }) {
  const maximum = Math.max(1, ...data.flatMap((item) => series.map((entry) => Number(item[entry.key]) || 0)))
  return (
    <section className="section-card min-w-0 p-4 sm:p-5" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gov-navy">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {series.map((entry) => (
            <span key={entry.key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className={`h-2 w-2 rounded-sm ${entry.color}`} />
              {entry.label}
            </span>
          ))}
        </div>
      </div>
      <div
        className="mt-5 grid h-44 items-end gap-1.5 border-b border-l border-slate-200 px-2 pb-2 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}
        role="img"
        aria-label={title}
      >
        {data.map((item) => (
          <div key={item.period} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {series.map((entry) => {
                const value = Number(item[entry.key]) || 0
                const height = value ? Math.max(3, (value / maximum) * 100) : 1
                return (
                  <span
                    key={entry.key}
                    className={`w-2.5 max-w-[38%] rounded-t-sm sm:w-4 ${entry.color}`}
                    style={{ height: `${height}%` }}
                    title={`${getPeriodLabel(item.period, month, year, locale)} · ${entry.label}: ${formatter(value, locale)}`}
                  />
                )
              })}
            </div>
            <span className="max-w-full truncate text-[10px] font-semibold text-slate-500">
              {getPeriodLabel(item.period, month, year, locale)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function DemographicTable({ title, rows, locale, t }) {
  return (
    <section className="section-card min-w-0 overflow-hidden" aria-label={title}>
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-base font-bold text-gov-navy">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('reports.demographicDescription')}</p>
      </div>
      <div className="table-scroll max-h-[360px]">
        <table className="w-full min-w-[590px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">{t('reports.category')}</th>
              <th className="px-3 py-3 text-right font-bold">{t('reports.members')}</th>
              <th className="px-3 py-3 text-right font-bold">{t('reports.loans')}</th>
              <th className="px-3 py-3 text-right font-bold">{t('reports.sanctioned')}</th>
              <th className="px-4 py-3 text-right font-bold">{t('reports.recovered')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-slate-50/70">
                <th scope="row" className="max-w-40 truncate px-4 py-3 font-semibold text-slate-700">{row.label}</th>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.membership_count, locale)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatNumber(row.loan_count, locale)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatCurrency(row.sanctioned_amount, locale)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(row.recovered_amount, locale)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">{t('reports.noDemographicData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DemographicChart({ title, rows, locale }) {
  const maximum = Math.max(1, ...rows.map((row) => Number(row.membership_count) || 0))
  return (
    <section className="section-card min-w-0 p-4 sm:p-5" aria-label={title}>
      <h2 className="text-base font-bold text-gov-navy">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const value = Number(row.membership_count) || 0
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-slate-700">{row.label}</span>
                <span className="shrink-0 tabular-nums text-slate-600">{formatNumber(value, locale)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-slate-100" role="img" aria-label={`${row.label}: ${formatNumber(value, locale)} members`}>
                <div className="h-full rounded-sm bg-gov-primary" style={{ width: `${value ? Math.max(2, value / maximum * 100) : 0}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function Reports() {
  const { t, language } = useLanguage()
  const { error: toastError, success } = useToast()
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN'
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1))
  const [reportType, setReportType] = useState('membership')
  const [filters, setFilters] = useState({ year: currentYear, month: null })
  const periodMode = filters.month ? 'month' : 'year'
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    let active = true
    const loadReport = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await reportService.getAnalytics(filters)
        if (active) setReport(data)
      } catch (err) {
        if (active) {
          setReport(null)
          setLoadError(err.response?.data?.detail || err.message || t('reports.loadError'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadReport()
    return () => { active = false }
  }, [filters, t])

  const periodLabel = reportType === 'portfolio'
    ? t('reports.currentPortfolio')
    : filters.month
    ? `${new Date(filters.year, filters.month - 1, 1).toLocaleDateString(locale, { month: 'long' })} ${filters.year}`
    : String(filters.year)

  const handleExport = async (format) => {
    if (!report || loading) return
    setExporting(format)
    try {
      await reportExportService.export({ report, type: reportType, format, filters })
      success(t(format === 'excel' ? 'reports.excelExported' : 'reports.pdfExported'))
    } catch (err) {
      toastError(err.message || t('reports.exportError'))
    } finally {
      setExporting('')
    }
  }

  const summary = report?.summary
  const demographicRows = reportType === 'gender'
    ? report?.gender_breakdown ?? []
    : reportType === 'caste'
      ? report?.caste_breakdown ?? []
      : []
  const demographicTotals = demographicRows.reduce((totals, row) => ({
    members: totals.members + row.membership_count,
    loans: totals.loans + row.loan_count,
    sanctioned: totals.sanctioned + Number(row.sanctioned_amount),
    recovered: totals.recovered + Number(row.recovered_amount),
  }), { members: 0, loans: 0, sanctioned: 0, recovered: 0 })

  const cardsByReport = {
    membership: [
      { icon: Users, label: t('reports.memberships'), value: summary?.membership_count, detail: `${formatNumber(summary?.active_members, locale)} ${t('reports.activeMembersInPeriod')}`, tone: 'bg-blue-50 text-gov-primary' },
      { icon: Users, label: t('reports.activeMembers'), value: summary?.active_members, detail: t('reports.currentStatus'), tone: 'bg-emerald-50 text-emerald-800' },
    ],
    loans: [
      { icon: Banknote, label: t('reports.loansSanctioned'), value: summary?.loan_count, detail: t('reports.duringPeriod'), tone: 'bg-sky-50 text-sky-800' },
      { icon: Landmark, label: t('reports.sanctionedAmount'), value: summary?.sanctioned_amount, amount: true, detail: t('reports.duringPeriod'), tone: 'bg-amber-50 text-amber-800' },
    ],
    recovery: [
      { icon: Activity, label: t('reports.recoveredAmount'), value: summary?.recovered_amount, amount: true, detail: t('reports.principalRecoveredPeriod'), tone: 'bg-emerald-50 text-emerald-800' },
    ],
    portfolio: [
      { icon: WalletCards, label: t('reports.outstandingAmount'), value: summary?.outstanding_amount, amount: true, detail: t('reports.currentPortfolio'), tone: 'bg-rose-50 text-rose-800' },
      { icon: Banknote, label: t('reports.openLoans'), value: summary?.open_loans, detail: t('reports.currentStatus'), tone: 'bg-teal-50 text-teal-800' },
      { icon: Banknote, label: t('reports.closedLoans'), value: summary?.closed_loans, detail: t('reports.currentStatus'), tone: 'bg-slate-100 text-slate-700' },
    ],
    gender: [
      { icon: Users, label: t('reports.memberships'), value: demographicTotals.members, detail: t('reports.selectedDemographic'), tone: 'bg-blue-50 text-gov-primary' },
      { icon: Banknote, label: t('reports.loansSanctioned'), value: demographicTotals.loans, detail: t('reports.selectedDemographic'), tone: 'bg-sky-50 text-sky-800' },
      { icon: Landmark, label: t('reports.sanctionedAmount'), value: demographicTotals.sanctioned, amount: true, detail: t('reports.selectedDemographic'), tone: 'bg-amber-50 text-amber-800' },
    ],
    caste: [
      { icon: Users, label: t('reports.memberships'), value: demographicTotals.members, detail: t('reports.selectedDemographic'), tone: 'bg-blue-50 text-gov-primary' },
      { icon: Banknote, label: t('reports.loansSanctioned'), value: demographicTotals.loans, detail: t('reports.selectedDemographic'), tone: 'bg-sky-50 text-sky-800' },
      { icon: Landmark, label: t('reports.sanctionedAmount'), value: demographicTotals.sanctioned, amount: true, detail: t('reports.selectedDemographic'), tone: 'bg-amber-50 text-amber-800' },
    ],
  }
  const cards = cardsByReport[reportType]
  const reportTitle = {
    membership: t('reports.membershipSummary'),
    loans: t('reports.loanStatement'),
    recovery: t('reports.recoveryReport'),
    portfolio: t('reports.portfolioReport'),
    gender: t('reports.genderWise'),
    caste: t('reports.casteWise'),
  }[reportType]

  return (
    <div className="page-stack">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <section className="section-card p-4 sm:p-5" aria-label={t('reports.filters')}>
        <div className={`grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:gap-4 ${periodMode === 'month' ? 'xl:grid-cols-[minmax(240px,2.2fr)_minmax(100px,0.8fr)_minmax(145px,1.1fr)_minmax(145px,1.1fr)_auto]' : 'xl:grid-cols-[minmax(240px,2.2fr)_minmax(100px,0.8fr)_minmax(145px,1.1fr)_auto]'}`}>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-600">
              {t('reports.reportType')}
              <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="min-h-10 w-full min-w-0 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20">
                <option value="membership">{t('reports.membershipSummary')}</option>
                <option value="loans">{t('reports.loanStatement')}</option>
                <option value="recovery">{t('reports.recoveryReport')}</option>
                <option value="portfolio">{t('reports.portfolioReport')}</option>
                <option value="gender">{t('reports.genderWise')}</option>
                <option value="caste">{t('reports.casteWise')}</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-600">
              {t('reports.year')}
              <select value={filters.year} disabled={reportType === 'portfolio'} onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) }))} className="min-h-10 w-full min-w-0 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20 disabled:bg-slate-100 disabled:text-slate-500">
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-600">
              {t('reports.periodView')}
              <select value={periodMode} disabled={reportType === 'portfolio'} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value === 'month' ? Number(selectedMonth) : null }))} className="min-h-10 w-full min-w-0 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20 disabled:bg-slate-100 disabled:text-slate-500">
                <option value="year">{t('reports.yearWise')}</option>
                <option value="month">{t('reports.monthWise')}</option>
              </select>
            </label>
            {periodMode === 'month' && (
              <label className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-600">
                {t('reports.month')}
                <select value={selectedMonth} disabled={reportType === 'portfolio'} onChange={(event) => {
                  setSelectedMonth(event.target.value)
                  setFilters((current) => ({ ...current, month: Number(event.target.value) }))
                }} className="min-h-10 w-full min-w-0 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20 disabled:bg-slate-100 disabled:text-slate-500">
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = index + 1
                    const label = new Date(2024, index, 1).toLocaleDateString(locale, { month: 'long' })
                    return <option key={month} value={month}>{label}</option>
                  })}
                </select>
              </label>
            )}
            <div className="flex items-center gap-2 xl:justify-end">
              <Button type="button" variant="outline" disabled={!report || loading || Boolean(exporting)} loading={exporting === 'pdf'} icon={<FileText className="h-4 w-4" />} onClick={() => handleExport('pdf')} className="w-full whitespace-nowrap sm:w-auto">{t('reports.exportPdf')}</Button>
              <Button type="button" variant="outline" disabled={!report || loading || Boolean(exporting)} loading={exporting === 'excel'} icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => handleExport('excel')} className="w-full whitespace-nowrap sm:w-auto">{t('reports.exportExcel')}</Button>
            </div>
        </div>
      </section>

      {loadError && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>}

      {report && !loading && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase text-gov-primary">{reportTitle}</p>
              <h2 className="mt-0.5 text-lg font-bold text-gov-navy">{periodLabel}</h2>
            </div>
            <p className="text-xs text-slate-500">
              {reportType === 'portfolio'
                ? t('reports.outstandingFootnote')
                : filters.month ? t('reports.weeklyBreakdown') : t('reports.monthlyBreakdown')}
            </p>
          </div>

          <section
            aria-label={t('reports.summary')}
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${cards.length === 2 ? 'xl:grid-cols-2' : cards.length === 1 ? 'xl:max-w-3xl xl:grid-cols-1' : 'xl:grid-cols-3'}`}
          >
            {cards.map((card) => <SummaryCard key={card.label} {...card} locale={locale} />)}
          </section>

          {(
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {reportType === 'membership' && (
                <div className="xl:col-span-2">
                  <TrendChart
                    title={t('reports.membershipTrend')}
                    description={filters.month ? t('reports.weeklyBreakdown') : t('reports.monthlyBreakdown')}
                    data={report.trend} month={filters.month} year={filters.year} locale={locale}
                    series={[{ key: 'membership_count', label: t('reports.memberships'), color: 'bg-blue-700' }]}
                    formatter={formatNumber}
                  />
                </div>
              )}
              {reportType === 'loans' && (
                <>
                  <TrendChart
                    title={t('reports.loanCountTrend')}
                    description={filters.month ? t('reports.weeklyBreakdown') : t('reports.monthlyBreakdown')}
                    data={report.trend} month={filters.month} year={filters.year} locale={locale}
                    series={[{ key: 'loan_count', label: t('reports.loans'), color: 'bg-amber-500' }]}
                    formatter={formatNumber}
                  />
                  <TrendChart
                    title={t('reports.sanctionedTrend')}
                    description={filters.month ? t('reports.weeklyBreakdown') : t('reports.monthlyBreakdown')}
                    data={report.trend} month={filters.month} year={filters.year} locale={locale}
                    series={[{ key: 'sanctioned_amount', label: t('reports.sanctionedAmount'), color: 'bg-sky-700' }]}
                    formatter={formatCurrency}
                  />
                </>
              )}
              {reportType === 'recovery' && (
                <div className="xl:col-span-2">
                  <TrendChart
                    title={t('reports.recoveryTrend')}
                    description={filters.month ? t('reports.weeklyRecovery') : t('reports.monthlyRecovery')}
                    data={report.trend} month={filters.month} year={filters.year} locale={locale}
                    series={[{ key: 'recovered_amount', label: t('reports.recovered'), color: 'bg-emerald-600' }]}
                    formatter={formatCurrency}
                  />
                </div>
              )}
              {(reportType === 'gender' || reportType === 'caste') && (
                <>
                  <DemographicChart title={reportTitle} rows={demographicRows} locale={locale} />
                  <DemographicTable title={reportTitle} rows={demographicRows} locale={locale} t={t} />
                </>
              )}
              {reportType === 'portfolio' && (
                <div className="section-card flex min-h-44 items-center gap-4 p-5 xl:col-span-2">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-800">
                    <WalletCards className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-bold text-gov-navy">{t('reports.currentPortfolio')}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('reports.outstandingFootnote')}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {loading && (
        <div className="grid gap-4 xl:grid-cols-2" aria-label={t('common.loading')}>
          <div className="section-card h-44 animate-pulse bg-slate-100" />
          <div className="section-card h-44 animate-pulse bg-slate-100" />
        </div>
      )}
    </div>
  )
}
