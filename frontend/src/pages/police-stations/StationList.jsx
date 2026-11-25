import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Pencil, ToggleLeft, ToggleRight, Search, X } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import DataTable from '../../components/common/DataTable.jsx'
import Button from '../../components/common/Button.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import policeStationService from '../../services/policeStationService.js'

const PAGE_SIZE = 20

export default function StationList() {
  const { t }                               = useLanguage()
  const { success, error: toastError }      = useToast()
  const navigate                            = useNavigate()

  const [stations, setStations]             = useState([])
  const [total, setTotal]                   = useState(0)
  const [page, setPage]                     = useState(1)
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen]       = useState(false)
  const [confirmTarget, setConfirmTarget]   = useState(null) // { ps_id, station_name, is_active }
  const [togglingId, setTogglingId]         = useState(null)

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(id)
  }, [search])

  const fetchStations = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, size: PAGE_SIZE, active_only: false }
      if (debouncedSearch) params.search = debouncedSearch
      const res = await policeStationService.getStations(params)
      setStations(res.items ?? res.data ?? [])
      setTotal(res.total_count ?? res.total ?? 0)
    } catch (err) {
      toastError(err.message || t('common.errorFetch'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => { fetchStations() }, [fetchStations])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const handleToggleClick = (station) => {
    setConfirmTarget(station)
    setConfirmOpen(true)
  }

  const handleToggleConfirm = async () => {
    if (!confirmTarget) return
    setTogglingId(confirmTarget.ps_id)
    setConfirmOpen(false)
    try {
      await policeStationService.toggleStationStatus(confirmTarget.ps_id)
      success(
        confirmTarget.is_active
          ? t('stations.deactivateSuccess')
          : t('stations.activateSuccess')
      )
      fetchStations()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setTogglingId(null)
      setConfirmTarget(null)
    }
  }

  const columns = [
    { key: 'ps_id',        label: t('stations.id'),      render: r => <span className="font-mono text-sm text-gray-600">{r.ps_id}</span> },
    { key: 'station_name', label: t('stations.name'),    render: r => <span className="font-medium">{r.station_name}</span> },
    { key: 'address',      label: t('stations.address'), render: r => r.address || '—' },
    {
      key: 'is_active',
      label: t('common.status'),
      render: r => (
        <span className={r.is_active ? 'badge-active' : 'badge-inactive'}>
          {r.is_active ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: r => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/police-stations/${r.ps_id}/edit`)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 border border-indigo-300 rounded hover:bg-indigo-50 transition-colors"
            title={t('common.edit')}
          >
            <Pencil className="w-3 h-3" />
            {t('common.edit')}
          </button>
          <button
            onClick={() => handleToggleClick(r)}
            disabled={togglingId === r.ps_id}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors
              ${r.is_active
                ? 'text-red-600 border-red-300 hover:bg-red-50'
                : 'text-green-600 border-green-300 hover:bg-green-50'
              } disabled:opacity-50`}
            title={r.is_active ? t('stations.deactivate') : t('stations.activate')}
          >
            {r.is_active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
            {r.is_active ? t('stations.deactivate') : t('stations.activate')}
          </button>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="page-stack">
      <PageHeader
        title={t('stations.title')}
        subtitle={t('stations.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => navigate('/police-stations/create')}
          >
            {t('stations.addStation')}
          </Button>
        }
      />

      {/* Search */}
      <div className="section-card p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('stations.searchPlaceholder')}
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
      </div>

      {!loading && (
        <p className="text-xs text-gray-500">
          {t('common.showingOf', { count: stations.length, total })}
        </p>
      )}

      <DataTable
        columns={columns}
        data={stations}
        loading={loading}
        emptyMessage={t('stations.noRecordsFound')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Confirm Toggle dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setConfirmTarget(null) }}
        onConfirm={handleToggleConfirm}
        title={confirmTarget?.is_active ? t('stations.deactivateConfirmTitle') : t('stations.activateConfirmTitle')}
        message={
          confirmTarget?.is_active
            ? t('stations.deactivateConfirmMsg', { name: confirmTarget?.station_name })
            : t('stations.activateConfirmMsg', { name: confirmTarget?.station_name })
        }
        confirmLabel={confirmTarget?.is_active ? t('stations.deactivate') : t('stations.activate')}
        confirmVariant={confirmTarget?.is_active ? 'danger' : 'success'}
      />
    </div>
  )
}
