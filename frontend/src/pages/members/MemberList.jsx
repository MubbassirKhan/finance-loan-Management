import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Eye, Search, X, Pencil, UserCheck, UserX, Columns3, FileSpreadsheet, FileText } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import DataTable from '../../components/common/DataTable.jsx'
import Button from '../../components/common/Button.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import MemberCreate from './MemberCreate.jsx'
import MemberDetails from './MemberDetails.jsx'
import OfficerLoanDrawer from '../loans/OfficerLoanDrawer.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import memberService from '../../services/memberService.js'
import policeStationService from '../../services/policeStationService.js'

const PAGE_SIZE = 20
const DEFAULT_VISIBLE_COLUMNS = ['kgid', 'share_number', 'buckle_number', 'full_name', 'designation', 'station', 'status']

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function MemberList() {
  const { t } = useLanguage()
  const { error: toastError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(DEFAULT_VISIBLE_COLUMNS)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [exporting, setExporting] = useState('')
  const [memberDialog, setMemberDialog] = useState(null)
  const [memberDrawerKgid, setMemberDrawerKgid] = useState(null)
  const columnsMenuRef = useRef(null)
  const columnsTriggerRef = useRef(null)

  useEffect(() => {
    const createRequested = searchParams.get('create') === '1'
    const editKgid = searchParams.get('edit')
    if (createRequested) {
      setMemberDialog({ mode: 'create' })
      setSearchParams({}, { replace: true })
    } else if (editKgid) {
      setMemberDialog({ mode: 'edit', kgid: editKgid })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Debounce search input 400ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    if (!columnsMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (!columnsMenuRef.current?.contains(event.target)) {
        setColumnsMenuOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setColumnsMenuOpen(false)
        columnsTriggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnsMenuOpen])

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

  const availableColumns = [
    { key: 'kgid', label: t('members.kgid'), value: r => r.kgid, render: r => <span className="inline-flex rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-gov-navy">{r.kgid}</span> },
    { key: 'share_number', label: t('members.shareNo'), value: r => r.share_number || '—', render: r => r.share_number || '—' },
    { key: 'buckle_number', label: t('members.buckleNo'), value: r => r.buckle_number || '—', render: r => r.buckle_number || '—' },
    { key: 'full_name', label: t('members.fullName'), value: r => r.full_name, render: r => <span className="font-semibold text-gov-navy">{r.full_name}</span> },
    { key: 'designation', label: t('members.designation'), value: r => r.designation || '—', render: r => r.designation || '—' },
    { key: 'ps_id', label: 'Police Station ID', value: r => r.ps_id ?? '—', render: r => r.ps_id ?? '—' },
    {
      key: 'station',
      label: t('members.station'),
      value: r => r.police_station_name || r.station_name || '—',
      render: r => r.police_station_name || r.station_name || '—',
    },
    { key: 'bank_account_masked', label: 'Bank Account (masked)', value: r => r.bank_account_masked || '—', render: r => <span className="font-mono">{r.bank_account_masked || '—'}</span> },
    { key: 'ifsc_code', label: 'IFSC Code', value: r => r.ifsc_code || '—', render: r => r.ifsc_code || '—' },
    { key: 'dob', label: 'Date of Birth', value: r => r.dob || '—', render: r => r.dob || '—' },
    { key: 'gender', label: 'Gender', value: r => r.gender || '—', render: r => r.gender || '—' },
    { key: 'caste', label: 'Caste', value: r => r.caste || '—', render: r => r.caste || '—' },
    { key: 'sub_caste', label: 'Sub-caste', value: r => r.sub_caste || '—', render: r => r.sub_caste || '—' },
    { key: 'category', label: 'Category', value: r => r.category || '—', render: r => r.category || '—' },
    { key: 'financial_year', label: 'Financial Year', value: r => r.financial_year || '—', render: r => r.financial_year || '—' },
    { key: 'financial_month', label: 'Financial Month', value: r => r.financial_month || '—', render: r => r.financial_month || '—' },
    {
      key: 'status',
      label: t('common.status'),
      value: r => r.status || '—',
      render: r => (
        <span className={r.status === 'Active' ? 'badge-active' : 'badge-inactive'}>
          {r.status}
        </span>
      ),
    },
    { key: 'mf_id', label: 'Membership Fee ID', value: r => r.mf_id ?? '—', render: r => r.mf_id ?? '—' },
    { key: 'created_at', label: 'Created At', value: r => r.created_at || '—', render: r => <span className="whitespace-nowrap text-xs">{r.created_at || '—'}</span> },
    { key: 'updated_at', label: 'Updated At', value: r => r.updated_at || '—', render: r => <span className="whitespace-nowrap text-xs">{r.updated_at || '—'}</span> },
  ]

  const columns = [
    ...availableColumns
      .filter(column => visibleColumnKeys.includes(column.key))
      .map(({ key, label, render }) => ({ key, label, render })),
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'center',
      className: 'w-[112px] min-w-[112px] whitespace-nowrap',
      render: r => (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setMemberDialog({ mode: 'view', kgid: r.kgid })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-gov-primary shadow-sm transition-colors hover:border-gov-primary hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary"
            title={t('common.view')}
            aria-label={`View ${r.full_name}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMemberDialog({ mode: 'edit', kgid: r.kgid })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-orange-200 bg-white text-orange-700 shadow-sm transition-colors hover:border-orange-400 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            title="Edit member"
            aria-label={`Edit ${r.full_name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMemberPendingStatus(r)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
              r.status === 'Active'
                ? 'border-red-200 text-red-700 hover:border-red-400 hover:bg-red-50 focus-visible:ring-red-500'
                : 'border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-emerald-600'
            }`}
            title={r.status === 'Active' ? 'Make member inactive' : 'Make member active'}
            aria-label={`${r.status === 'Active' ? 'Make inactive' : 'Make active'}: ${r.full_name}`}
          >
            {r.status === 'Active'
              ? <UserX className="h-3.5 w-3.5" />
              : <UserCheck className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const exportMembers = async (format) => {
    setExporting(format)
    try {
      const allMembers = await memberService.getAllMembers({
        search: debouncedSearch,
        ps_id: stationId,
        status,
      })
      const selectedColumns = availableColumns.filter(column => visibleColumnKeys.includes(column.key))
      const timestamp = new Date().toISOString().slice(0, 10)

      if (format === 'excel') {
        const { default: ExcelJS } = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'SP Office Membership System'
        const worksheet = workbook.addWorksheet('Members', { views: [{ state: 'frozen', ySplit: 1 }] })
        worksheet.addRow(selectedColumns.map(column => column.label))
        allMembers.forEach(member => {
          worksheet.addRow(selectedColumns.map(column => column.value(member)))
        })
        worksheet.columns = selectedColumns.map(column => ({
          width: Math.min(36, Math.max(14, column.label.length + 4)),
        }))
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF17324D' },
        }
        const buffer = await workbook.xlsx.writeBuffer()
        downloadBlob(
          new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `members-${timestamp}.xlsx`,
        )
      } else {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable'),
        ])
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
        pdf.setFontSize(14)
        pdf.text('Police Personnel Members', 36, 30)
        autoTable(pdf, {
          startY: 42,
          head: [selectedColumns.map(column => column.label)],
          body: allMembers.map(member => selectedColumns.map(column => String(column.value(member) ?? ''))),
          styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
          headStyles: { fillColor: [23, 50, 77] },
          margin: { left: 36, right: 36 },
        })
        pdf.save(`members-${timestamp}.pdf`)
      }
    } catch (err) {
      toastError(err.message || `Could not export members as ${format.toUpperCase()}.`)
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setMemberDialog({ mode: 'create' })}
          >
            {t('members.registerNew')}
          </Button>
        }
      />

      <div className="section-card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-[1_1_300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('members.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-full rounded-sm border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={stationId}
          onChange={e => setStationId(e.target.value)}
          aria-label={t('members.allStations')}
          className="h-10 min-w-[180px] flex-[0_1_210px] rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{t('members.allStations')}</option>
          {stations.map(s => (
            <option key={s.ps_id} value={s.ps_id}>{s.station_name}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label={t('common.allStatuses')}
          className="h-10 min-w-[140px] flex-[0_1_155px] rounded-sm border border-slate-300 bg-white px-3 text-sm text-slate-700 transition-colors focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="Active">{t('common.active')}</option>
          <option value="Inactive">{t('common.inactive')}</option>
        </select>

        {(search || stationId || status) && (
          <Button variant="outline" size="sm" className="h-10 rounded-sm whitespace-nowrap transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98]" onClick={() => { setSearch(''); setStationId(''); setStatus('') }}>
            {t('common.clearFilters')}
          </Button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div ref={columnsMenuRef} className="relative">
            <button
              type="button"
              ref={columnsTriggerRef}
              onClick={() => setColumnsMenuOpen(open => !open)}
              aria-expanded={columnsMenuOpen}
              aria-haspopup="true"
              aria-controls="member-columns-menu"
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-sm border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gov-primary hover:bg-blue-50 hover:text-gov-primary hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
            >
              <Columns3 className="h-4 w-4" /> Columns
            </button>
            {columnsMenuOpen && (
              <div id="member-columns-menu" className="absolute right-0 z-20 mt-1 max-h-80 w-60 overflow-y-auto rounded border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-2 border-b border-slate-200 pb-2 text-xs font-semibold uppercase text-slate-500">Visible columns</p>
                {availableColumns.map(column => (
                  <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={visibleColumnKeys.includes(column.key)}
                      onChange={event => {
                        setVisibleColumnKeys(keys => event.target.checked
                          ? [...keys, column.key]
                          : keys.filter(key => key !== column.key))
                      }}
                      className="h-4 w-4 accent-gov-primary"
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-sm whitespace-nowrap transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => exportMembers('pdf')}
            disabled={Boolean(exporting) || loading || total === 0 || visibleColumnKeys.length === 0}
            loading={exporting === 'pdf'}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-sm whitespace-nowrap transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => exportMembers('excel')}
            disabled={Boolean(exporting) || loading || total === 0 || visibleColumnKeys.length === 0}
            loading={exporting === 'excel'}
          >
            Excel
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {t('common.showingOf', { count: members.length, total })}
      </p>

      {/* Table */}
      <DataTable
        columns={columns}
        data={members}
        loading={loading}
        emptyMessage={t('members.noRecordsFound')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(member) => setMemberDrawerKgid(member.kgid)}
        getRowLabel={(member) => `Open full record for ${member.full_name}`}
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

      {memberDialog?.mode === 'create' && (
        <MemberCreate
          onClose={() => setMemberDialog(null)}
          onSaved={(savedMember) => {
            setMemberDialog({ mode: 'view', kgid: savedMember.kgid })
            fetchMembers()
          }}
        />
      )}
      {memberDialog?.mode === 'edit' && (
        <MemberCreate
          initialKgid={memberDialog.kgid}
          onClose={() => setMemberDialog(null)}
          onSaved={(savedMember) => {
            setMemberDialog({ mode: 'view', kgid: savedMember.kgid })
            fetchMembers()
          }}
        />
      )}
      {memberDialog?.mode === 'view' && (
        <MemberDetails
          memberKgid={memberDialog.kgid}
          isModal
          onClose={() => setMemberDialog(null)}
          onEdit={() => setMemberDialog({ mode: 'edit', kgid: memberDialog.kgid })}
          onUpdated={fetchMembers}
        />
      )}
      <OfficerLoanDrawer
        isOpen={Boolean(memberDrawerKgid)}
        onClose={() => setMemberDrawerKgid(null)}
        kgid={memberDrawerKgid}
        initialTab="membership"
      />
    </div>
  )
}
