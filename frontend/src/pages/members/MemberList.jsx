import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Eye, Search, X, Pencil, UserCheck, UserX } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import DataTable from '../../components/common/DataTable.jsx'
import Button from '../../components/common/Button.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import memberService from '../../services/memberService.js'
import policeStationService from '../../services/policeStationService.js'

const PAGE_SIZE = 20

export default function MemberList() {
  const { t } = useLanguage()
  const { error: toastError } = useToast()
  const navigate = useNavigate()

  // Data
  const [members, setMembers]   = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)

  // Filters
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stationId, setStationId] = useState('')
  const [status, setStatus]     = useState('')
  const [stations, setStations] = useState([])
  const [memberPendingStatus, setMemberPendingStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // Debounce search input 400ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(id)
  }, [search])

  // Load stations for filter dropdown once
  useEffect(() => {
    policeStationService
      .getStations({ page: 1, size: 100, active_only: false })
      .then(res => setStations(res.items ?? res.data ?? []))
      .catch(() => {})
  }, [])

  // Fetch members whenever filters/page change
  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, size: PAGE_SIZE }
      if (debouncedSearch) params.search = debouncedSearch
      if (stationId)       params.ps_id  = stationId
      if (status)          params.status = status

      const res = await memberService.getMembers(params)
      setMembers(res.items ?? res.data ?? [])
      setTotal(res.total_count ?? res.total ?? 0)
    } catch (err) {
      toastError(err.message || t('common.errorFetch'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, stationId, status])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const confirmStatusChange = async () => {
    if (!memberPendingStatus) return
    const nextStatus = memberPendingStatus.status === 'Active' ? 'Inactive' : 'Active'
    setStatusLoading(true)
    try {
      await memberService.updateMemberStatus(memberPendingStatus.kgid, nextStatus)
      setMemberPendingStatus(null)
      await fetchMembers()
    } catch (err) {
      toastError(err.message || 'Could not update member status.')
    } finally {
      setStatusLoading(false)
    }
  }

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, stationId, status])

  const columns = [
    { key: 'kgid',          label: t('members.kgid'),        render: r => <span className="font-mono text-sm">{r.kgid}</span> },
    { key: 'share_number',  label: t('members.shareNo'),     render: r => r.share_number || '—' },
    { key: 'buckle_number', label: t('members.buckleNo'),    render: r => r.buckle_number || '—' },
    { key: 'full_name',     label: t('members.fullName'),    render: r => <span className="font-medium">{r.full_name}</span> },
    { key: 'designation',   label: t('members.designation'), render: r => r.designation || '—' },
    {
      key: 'station',
      label: t('members.station'),
      render: r => r.station_name || r.ps_id || '—',
    },
    {
      key: 'status',
      label: t('common.status'),
      render: r => (
        <span className={r.status === 'Active' ? 'badge-active' : 'badge-inactive'}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => navigate(`/members/${encodeURIComponent(r.kgid)}`)}
            className="inline-flex items-center gap-1 rounded border border-gov-primary px-2 py-1 text-xs font-medium text-gov-primary transition-colors hover:bg-blue-50"
            title={t('common.view')}
          >
            <Eye className="h-3 w-3" />
            {t('common.view')}
          </button>
          <button
            onClick={() => navigate(`/members/${encodeURIComponent(r.kgid)}/edit`)}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            title="Edit member"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() => setMemberPendingStatus(r)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
              r.status === 'Active'
                ? 'border-red-300 text-red-700 hover:bg-red-50'
                : 'border-green-300 text-green-700 hover:bg-green-50'
            }`}
            title={r.status === 'Active' ? 'Make member inactive' : 'Make member active'}
          >
            {r.status === 'Active'
              ? <><UserX className="h-3 w-3" /> Make Inactive</>
              : <><UserCheck className="h-3 w-3" /> Make Active</>}
          </button>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => navigate('/members/create')}
          >
            {t('members.registerNew')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="section-card p-4 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('members.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gov-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Station filter */}
        <select
          value={stationId}
          onChange={e => setStationId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gov-primary min-w-44"
        >
          <option value="">{t('members.allStations')}</option>
          {stations.map(s => (
            <option key={s.ps_id} value={s.ps_id}>{s.station_name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gov-primary"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="Active">{t('common.active')}</option>
          <option value="Inactive">{t('common.inactive')}</option>
        </select>

        {/* Clear */}
        {(search || stationId || status) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStationId(''); setStatus('') }}>
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-xs text-gray-500">
          {t('common.showingOf', { count: members.length, total })}
        </p>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={members}
        loading={loading}
        emptyMessage={t('members.noRecordsFound')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <ConfirmDialog
        isOpen={Boolean(memberPendingStatus)}
        onClose={() => setMemberPendingStatus(null)}
        onConfirm={confirmStatusChange}
        loading={statusLoading}
        title={memberPendingStatus?.status === 'Active' ? 'Make Member Inactive?' : 'Make Member Active?'}
        message={memberPendingStatus?.status === 'Active'
          ? 'This member record will be kept and marked inactive. No data will be deleted.'
          : 'This member record will be marked active again.'}
        confirmLabel={memberPendingStatus?.status === 'Active' ? 'Make Inactive' : 'Make Active'}
        confirmVariant={memberPendingStatus?.status === 'Active' ? 'danger' : 'success'}
      />
    </div>
  )
}
