import React, { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Search, CircleAlert, ListChecks } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import loanService from '../../services/loanService.js'
import policeStationService from '../../services/policeStationService.js'

const PAGE_SIZE = 50
const MAX_BULK_SELECTION = 500
const LOAN_SCHEMES = [
  { value: 'Society Personal Advance', key: 'societyPersonal' },
  { value: 'Housing Assistance Advance', key: 'housingAssistance' },
  { value: 'Emergency Medical Advance', key: 'emergencyMedical' },
  { value: 'Festival Advance', key: 'festival' },
  { value: 'Education Assistance Advance', key: 'educationAssistance' },
]

function currentMonthValue() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(value, locale) {
  return `₹${Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  })}`
}

function formatMonth(value, locale) {
  if (!value) return ''
  return new Date(`${value}-01T00:00:00`).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
}

function getSchemeLabel(scheme, t) {
  const entry = LOAN_SCHEMES.find((item) => item.value === scheme)
  return entry ? t(`schedules.schemes.${entry.key}`) : scheme
}

function getStatusLabel(item, t) {
  if (item.is_paid) return t('schedules.received')
  if (item.status === 'Due') return t('schedules.due')
  if (item.status === 'Upcoming') return t('schedules.upcoming')
  if (item.status === 'Schedule missing') return t('schedules.missingSchedule')
  if (item.status.startsWith('Waiting for installment #')) {
    return t('schedules.waitingForInstallment', { number: item.next_installment_number })
  }
  return item.status
}

function shiftMonth(value, offset) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Schedules() {
  const { success, error, info } = useToast()
  const { t, language } = useLanguage()
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN'
  const [month, setMonth] = useState(currentMonthValue)
  const [search, setSearch] = useState('')
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [stationId, setStationId] = useState('')
  const [loanType, setLoanType] = useState('')
  const [stations, setStations] = useState([])
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [schedules, setSchedules] = useState([])
  const [total, setTotal] = useState(0)
  const [selectedSchedules, setSelectedSchedules] = useState(() => new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectingUpcoming, setSelectingUpcoming] = useState(false)

  useEffect(() => {
    let active = true
    policeStationService.getStations({ page: 1, size: 100, active_only: false })
      .then((data) => {
        if (active) setStations(data.items || data.data || [])
      })
      .catch(() => {
        if (active) error(t('schedules.stationFiltersError'))
      })
    return () => { active = false }
  }, [error, t])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const data = await loanService.getMonthlySchedules({
          month,
          search,
          page,
          size: PAGE_SIZE,
          schedule_status: scheduleStatus,
          ps_id: stationId,
          loan_type: loanType,
        })
        if (active) {
          setSchedules(data.items || [])
          setTotal(data.total || 0)
        }
      } catch {
        if (active) error(t('schedules.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    }, search ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [month, search, scheduleStatus, stationId, loanType, page, reloadKey, error, t])

  const selectedLoanIds = new Set(selectedSchedules.keys())
  const blockedSelectedSchedules = [...selectedSchedules.values()].filter((item) => !item.can_mark)
  const selectableSchedules = schedules.filter((item) => !item.is_paid)
  const unselectedVisibleCount = selectableSchedules.filter((item) => !selectedLoanIds.has(item.loan_id)).length
  const allVisibleSelected = selectableSchedules.length > 0
    && selectableSchedules.every((item) => selectedLoanIds.has(item.loan_id))
  const canSelectAllVisible = selectedLoanIds.size + unselectedVisibleCount <= MAX_BULK_SELECTION
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleMonthChange = (nextMonth) => {
    setMonth(nextMonth)
    setPage(1)
    setSelectedSchedules(new Map())
  }

  const handleFilterChange = (setter, value) => {
    setter(value)
    setPage(1)
    setSelectedSchedules(new Map())
  }

  const toggleVisibleSelection = () => {
    setSelectedSchedules((current) => {
      const next = new Map(current)
      if (allVisibleSelected) {
        selectableSchedules.forEach((item) => next.delete(item.loan_id))
      } else {
        selectableSchedules.forEach((item) => next.set(item.loan_id, item))
      }
      return next
    })
  }

  const toggleLoanSelection = (item) => {
    setSelectedSchedules((current) => {
      const next = new Map(current)
      if (next.has(item.loan_id)) next.delete(item.loan_id)
      else next.set(item.loan_id, item)
      return next
    })
  }

  const handleBulkUpdate = async (targetStatus) => {
    const loanIds = [...selectedSchedules.keys()]
    if (loanIds.length === 0 || blockedSelectedSchedules.length > 0) return

    setSaving(true)
    try {
      const result = await loanService.bulkUpdateMonthlySchedules({
        month,
        loan_ids: loanIds,
        status: targetStatus,
      })
      setSelectedSchedules(new Map())
      setReloadKey((value) => value + 1)
      success(t(targetStatus === 'Paid' ? 'schedules.bulkReceivedSuccess' : 'schedules.bulkDueSuccess', {
        count: result.updated,
        month: formatMonth(month, locale),
      }))
    } catch (err) {
      error(err.response?.data?.detail || err.message || t('schedules.updateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSelectAllUpcoming = async () => {
    setSelectingUpcoming(true)
    try {
      const data = await loanService.getMonthlySchedules({
        month,
        search,
        schedule_status: 'Upcoming',
        ps_id: stationId,
        loan_type: loanType,
        page: 1,
        size: MAX_BULK_SELECTION,
      })
      const upcomingRows = (data.items || []).filter((item) => !item.is_paid && item.can_mark)
      setSelectedSchedules(new Map(upcomingRows.map((item) => [item.loan_id, item])))
      if (data.total > MAX_BULK_SELECTION) {
        info(t('schedules.upcomingSelectionLimit', { limit: MAX_BULK_SELECTION }))
      } else if (upcomingRows.length > 0) {
        success(t('schedules.upcomingSelected', { count: upcomingRows.length }))
      } else {
        info(t('schedules.noUpcomingMatches'))
      }
    } catch (err) {
      error(err.response?.data?.detail || err.message || t('schedules.selectUpcomingError'))
    } finally {
      setSelectingUpcoming(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('schedules.eyebrow')}
        title={t('schedules.title')}
        subtitle={t('schedules.subtitle')}
      />

      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,43,70,0.06)]">
          <div className="overflow-x-auto border-b border-slate-200 bg-slate-50 p-4">
            <div className="grid min-w-[1042px] grid-cols-[300px_175px_145px_190px_200px] items-end gap-2">
            <label className="block w-full sm:max-w-xs">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">{t('schedules.month')}</span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleMonthChange(shiftMonth(month, -1))}
                  aria-label={t('schedules.previousMonth')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="relative min-w-0 flex-1">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="month"
                    value={month}
                    onChange={(event) => handleMonthChange(event.target.value)}
                    aria-label={t('schedules.month')}
                    className="h-10 w-full rounded border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => handleMonthChange(shiftMonth(month, 1))}
                  aria-label={t('schedules.nextMonth')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {month !== currentMonthValue() && (
                  <button
                    type="button"
                    onClick={() => handleMonthChange(currentMonthValue())}
                    className="h-10 shrink-0 rounded border border-gov-primary px-2.5 text-xs font-bold text-gov-primary hover:bg-blue-50"
                  >
                    {t('schedules.thisMonth')}
                  </button>
                )}
              </span>
            </label>

            <div className="contents">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">{t('schedules.status')}</span>
                <select
                  value={scheduleStatus}
                  onChange={(event) => handleFilterChange(setScheduleStatus, event.target.value)}
                  className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20"
                >
                  <option value="">{t('schedules.allStatuses')}</option>
                  <option value="Upcoming">{t('schedules.upcoming')}</option>
                  <option value="Due">{t('schedules.due')}</option>
                  <option value="Received">{t('schedules.received')}</option>
                  <option value="Waiting">{t('schedules.waiting')}</option>
                  <option value="Missing">{t('schedules.missingSchedule')}</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">{t('schedules.station')}</span>
                <select
                  value={stationId}
                  onChange={(event) => handleFilterChange(setStationId, event.target.value)}
                  className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20"
                >
                  <option value="">{t('schedules.allStations')}</option>
                  {stations.map((station) => (
                    <option key={station.ps_id} value={station.ps_id}>{station.station_name}</option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">{t('schedules.loanScheme')}</span>
                <select
                  value={loanType}
                  onChange={(event) => handleFilterChange(setLoanType, event.target.value)}
                  className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20"
                >
                  <option value="">{t('schedules.allLoanSchemes')}</option>
                  {LOAN_SCHEMES.map((scheme) => (
                    <option key={scheme.value} value={scheme.value}>{t(`schedules.schemes.${scheme.key}`)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block w-full min-w-0">
              <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">{t('schedules.searchMembers')}</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                  placeholder={t('schedules.searchPlaceholder')}
                  className="h-10 w-full rounded border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-gov-primary/20"
                />
              </span>
            </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600" aria-live="polite">
              <strong className="text-slate-900">{t('schedules.scheduleCount', { count: total })}</strong>
              <span className="mx-2 text-slate-300">|</span>
              <strong className="text-slate-900">{t('schedules.selectedCount', { count: selectedLoanIds.size })}</strong>
            </p>
            <div className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={handleSelectAllUpcoming}
                disabled={selectingUpcoming || saving || loading}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-amber-500 bg-amber-100 px-3 text-xs font-bold text-amber-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ListChecks className="h-4 w-4" />
                {selectingUpcoming ? t('schedules.selectingUpcoming') : t('schedules.selectAllUpcoming')}
              </button>
              {selectedLoanIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSchedules(new Map())}
                  disabled={saving}
                  className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {t('schedules.clearSelection')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleBulkUpdate('Paid')}
                disabled={selectedLoanIds.size === 0 || blockedSelectedSchedules.length > 0 || saving || loading}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {saving ? t('schedules.updating') : t('schedules.markSelectedReceived')}
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdate('Due')}
                disabled={selectedLoanIds.size === 0 || blockedSelectedSchedules.length > 0 || saving || loading}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-red-700 bg-red-700 px-3 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CircleAlert className="h-4 w-4" />
                {saving ? t('schedules.updating') : t('schedules.markSelectedDue')}
              </button>
            </div>
          </div>

          {blockedSelectedSchedules.length > 0 && (
            <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
              <p className="font-bold">{t('schedules.blockedHeader')}</p>
              <ul className="mt-1 space-y-1">
                {blockedSelectedSchedules.map((item) => (
                  <li key={item.loan_id}>
                    {item.full_name} · {getSchemeLabel(item.loan_type, t)}:{' '}
                    {item.next_installment_number
                      ? t('schedules.markInstallmentFirst', { number: item.next_installment_number })
                      : t('schedules.scheduleUnavailable')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-gov-navy text-xs font-bold uppercase text-white">
                <tr>
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      disabled={loading || saving || selectableSchedules.length === 0 || (!allVisibleSelected && !canSelectAllVisible)}
                      aria-label={t('schedules.selectAllOnPage')}
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </th>
                  <th className="px-4 py-3">{t('schedules.memberKgid')}</th>
                  <th className="px-4 py-3">{t('schedules.station')}</th>
                  <th className="px-4 py-3">{t('schedules.loanScheme')}</th>
                  <th className="px-4 py-3 text-center">{t('schedules.installment')}</th>
                  <th className="px-4 py-3 text-right">{t('schedules.scheduledAmount')}</th>
                  <th className="px-4 py-3 text-center">{t('schedules.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">{t('schedules.loading')}</td></tr>
                ) : schedules.length === 0 ? (
                  <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">{t('schedules.empty', { month: formatMonth(month, locale) })}</td></tr>
                ) : schedules.map((item) => (
                  <tr
                    key={item.loan_id}
                    className={item.is_paid ? 'bg-emerald-50' : item.status === 'Due' ? 'bg-red-50' : item.can_mark ? 'bg-white hover:bg-slate-50' : 'bg-slate-50'}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedLoanIds.has(item.loan_id)}
                        onChange={() => toggleLoanSelection(item)}
                        disabled={item.is_paid || saving || (!selectedLoanIds.has(item.loan_id) && selectedLoanIds.size >= MAX_BULK_SELECTION)}
                        aria-label={t('schedules.selectMemberScheme', { name: item.full_name, scheme: getSchemeLabel(item.loan_type, t) })}
                        className="h-4 w-4 accent-gov-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.full_name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{item.kgid}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.station_name}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{getSchemeLabel(item.loan_type, t)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{t('schedules.loanNumber', { id: item.loan_id })}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700">{item.installment_number}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{formatCurrency(item.scheduled_amount, locale)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-bold ${
                        item.is_paid
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                          : item.status === 'Due'
                          ? 'border-red-300 bg-red-100 text-red-800'
                          : item.status === 'Upcoming'
                          ? 'border-amber-300 bg-amber-100 text-amber-900'
                          : 'border-slate-300 bg-slate-100 text-slate-700'
                      }`}>
                        {getStatusLabel(item, t)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs text-slate-600">{t('schedules.pageCount', { page, total: pageCount })}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1 || loading}
                aria-label={t('schedules.previousPage')}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                disabled={page >= pageCount || loading}
                aria-label={t('schedules.nextPage')}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}