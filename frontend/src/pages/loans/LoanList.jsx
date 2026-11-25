import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  PlusCircle, Search, X, Columns3, Download, Eye, Pencil,
  IndianRupee, ChevronLeft, ChevronRight, Inbox, Paperclip, Upload
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Select from '../../components/common/Select.jsx'
import Modal from '../../components/common/Modal.jsx'
import OfficerLoanDrawer from './OfficerLoanDrawer.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import loanService from '../../services/loanService.js'
import memberService from '../../services/memberService.js'
import policeStationService from '../../services/policeStationService.js'

const PAGE_SIZE = 20

const LOAN_TYPES = [
  'Society Personal Advance',
  'Housing Assistance Advance',
  'Emergency Medical Advance',
  'Festival Advance',
  'Education Assistance Advance',
]

const LOAN_STATUSES = ['Active', 'Sanctioned', 'Closed']

function formatINR(val) {
  if (val == null || val === '') return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const DEFAULT_VISIBLE_COLUMNS = {
  sl_no: false,
  rank: false,
  kgid: true,
  station: true,
  loan_type: false,
  sanction_date: true,
  sanction_amount: true,
  monthly_interest: true,
  recovered: true,
  outstanding: true,
  installments: false,
  status: true,
}

export default function LoanList() {
  const { t } = useLanguage()
  const { success, error: toastError } = useToast()

  // Data state
  const [loans, setLoans] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Dropdown data
  const [stations, setStations] = useState([])
  const [members, setMembers] = useState([])

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Column visibility dropdown
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLUMNS)
  const colMenuRef = useRef(null)

  // Modals & Drawer state
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [savingLoan, setSavingLoan] = useState(false)

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentTargetLoan, setPaymentTargetLoan] = useState(null)
  const [paymentCallback, setPaymentCallback] = useState(null)
  const [savingPayment, setSavingPayment] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerKgid, setDrawerKgid] = useState(null)
  const [drawerLoanId, setDrawerLoanId] = useState(null)

  // Forms
  const loanForm = useForm({ mode: 'onBlur' })
  const paymentForm = useForm({ mode: 'onBlur' })

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(id)
  }, [search])

  // Close column menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) {
        setColMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load stations & members for filters and Loan Creation form
  useEffect(() => {
    Promise.all([
      policeStationService.getStations({ page: 1, size: 100, active_only: false }),
      memberService.getMembers({ page: 1, size: 100 }),
    ])
      .then(([stRes, memRes]) => {
        setStations(stRes.items ?? stRes.data ?? [])
        setMembers(memRes.items ?? memRes.data ?? [])
      })
      .catch(() => {})
  }, [])

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, size: PAGE_SIZE }
      if (debouncedSearch) params.search = debouncedSearch
      if (loanTypeFilter) params.loan_type = loanTypeFilter
      if (stationFilter) params.ps_id = stationFilter
      if (statusFilter) params.status = statusFilter

      const res = await loanService.getLoans(params)
      setLoans(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toastError(err.message || t('common.errorFetch'))
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, loanTypeFilter, stationFilter, statusFilter])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, loanTypeFilter, stationFilter, statusFilter])

  // Open Create Loan Modal
  const openCreateLoan = () => {
    setEditingLoan(null)
    setSelectedFile(null)
    const today = new Date().toISOString().split('T')[0]
    loanForm.reset({
      kgid: '',
      ps_id: '',
      loan_type: LOAN_TYPES[0],
      sanction_date: today,
      sanction_amount: '',
      monthly_principal: '',
      interest_rate: '0',
      start_month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      end_date: '',
      total_installments: '12',
      document_attachment: '',
      status: 'Active',
    })
    setLoanModalOpen(true)
  }

  // Open Edit Loan Modal
  const openEditLoan = (loan, e) => {
    e?.stopPropagation()
    setEditingLoan(loan)
    setSelectedFile(null)
    const sanctionAmt = Number(loan.sanction_amount || 0)
    const monthlyInt = Number(loan.monthly_interest || 0)
    const computedRate = sanctionAmt > 0 ? parseFloat(((monthlyInt / sanctionAmt) * 100).toFixed(4)) : 0
    loanForm.reset({
      kgid: loan.kgid,
      ps_id: String(loan.ps_id),
      loan_type: loan.loan_type,
      sanction_date: loan.sanction_date,
      sanction_amount: String(loan.sanction_amount),
      monthly_principal: String(loan.monthly_principal),
      interest_rate: String(computedRate),
      start_month: loan.start_month,
      end_date: loan.end_date,
      total_installments: String(loan.total_installments),
      document_attachment: loan.document_attachment || '',
      status: loan.status,
    })
    setLoanModalOpen(true)
  }

  // Auto-fill station when member KGID is selected in Create modal
  const watchedKgid = loanForm.watch('kgid')
  useEffect(() => {
    if (!editingLoan && watchedKgid) {
      const m = members.find((item) => item.kgid === watchedKgid)
      if (m && m.ps_id) {
        loanForm.setValue('ps_id', String(m.ps_id))
      }
    }
  }, [watchedKgid, editingLoan, members])

  // Live preview of calculated monthly interest from percentage
  const watchedSanctionAmount = parseFloat(loanForm.watch('sanction_amount') || 0)
  const watchedInterestRate = parseFloat(loanForm.watch('interest_rate') || 0)
  const calculatedMonthlyInterest = Number(
    (((isNaN(watchedSanctionAmount) ? 0 : watchedSanctionAmount) *
      (isNaN(watchedInterestRate) ? 0 : watchedInterestRate)) /
      100).toFixed(2)
  )

  // Submit Create or Edit Loan
  const handleLoanSubmit = async (data) => {
    setSavingLoan(true)
    try {
      const sanctionAmt = parseFloat(data.sanction_amount)
      const ratePct = parseFloat(data.interest_rate || 0)
      const computedMonthlyInterest = Number(((sanctionAmt * ratePct) / 100).toFixed(2))

      const payload = {
        kgid: data.kgid,
        ps_id: data.ps_id ? parseInt(data.ps_id, 10) : null,
        loan_type: data.loan_type,
        sanction_date: data.sanction_date,
        sanction_amount: sanctionAmt,
        monthly_principal: parseFloat(data.monthly_principal),
        monthly_interest: computedMonthlyInterest,
        start_month: data.start_month,
        end_date: data.end_date,
        total_installments: parseInt(data.total_installments, 10),
        document_attachment: data.document_attachment || null,
        status: data.status || 'Active',
      }

      let savedLoan
      if (editingLoan) {
        const { kgid, ...updatePayload } = payload
        savedLoan = await loanService.updateLoan(editingLoan.loan_id, updatePayload)
        if (selectedFile) {
          await loanService.uploadAttachment(savedLoan.loan_id, selectedFile)
        }
        success(t('loans.updateSuccess'))
      } else {
        savedLoan = await loanService.createLoan(payload)
        if (selectedFile) {
          await loanService.uploadAttachment(savedLoan.loan_id, selectedFile)
        }
        success(t('loans.createSuccess'))
      }
      setSelectedFile(null)
      setLoanModalOpen(false)
      fetchLoans()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setSavingLoan(false)
    }
  }

  // Open Record Payment Modal
  const openPaymentModal = (loan, onDoneCallback = null, e = null) => {
    e?.stopPropagation()
    setPaymentTargetLoan(loan)
    setPaymentCallback(() => onDoneCallback)
    const today = new Date().toISOString().split('T')[0]
    paymentForm.reset({
      recovered_amount: String(loan.monthly_principal || ''),
      total_interest: String(loan.monthly_interest || '0'),
      payment_date: today,
      status: 'Paid',
    })
    setPaymentModalOpen(true)
  }

  const handlePaymentSubmit = async (data) => {
    if (!paymentTargetLoan) return
    setSavingPayment(true)
    try {
      await loanService.recordPayment(paymentTargetLoan.loan_id, {
        recovered_amount: parseFloat(data.recovered_amount),
        total_interest: parseFloat(data.total_interest || 0),
        payment_date: data.payment_date,
        status: data.status || 'Paid',
      })
      success(t('loans.paymentSuccess'))
      setPaymentModalOpen(false)
      fetchLoans()
      if (paymentCallback) paymentCallback()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setSavingPayment(false)
    }
  }

  // Open Officer Transactional History Drawer
  const openHistoryDrawer = (loan) => {
    setDrawerKgid(loan.kgid)
    setDrawerLoanId(loan.loan_id)
    setDrawerOpen(true)
  }

  // Export currently visible columns to CSV
  const handleExportCSV = () => {
    const colDefs = [
      visibleCols.sl_no && { key: 'sl_no', label: 'Sl. No.', get: (_, idx) => (page - 1) * PAGE_SIZE + idx + 1 },
      { key: 'full_name', label: 'Officer Name', get: (r) => r.full_name },
      visibleCols.rank && { key: 'rank', label: 'Rank', get: (r) => r.designation },
      visibleCols.kgid && { key: 'kgid', label: 'KGID', get: (r) => r.kgid },
      visibleCols.station && { key: 'station', label: 'Police Station', get: (r) => r.station_name },
      visibleCols.loan_type && { key: 'loan_type', label: 'Loan Scheme / Type', get: (r) => r.loan_type },
      visibleCols.sanction_date && { key: 'sanction_date', label: 'Sanction Date', get: (r) => r.sanction_date },
      visibleCols.sanction_amount && { key: 'sanction_amount', label: 'Sanction (INR)', get: (r) => r.sanction_amount },
      visibleCols.monthly_interest && { key: 'monthly_interest', label: 'Interest (INR)', get: (r) => r.monthly_interest },
      visibleCols.recovered && { key: 'recovered', label: 'Recovered (INR)', get: (r) => r.total_recovered },
      visibleCols.outstanding && { key: 'outstanding', label: 'Outstanding (INR)', get: (r) => r.outstanding_balance },
      visibleCols.installments && { key: 'installments', label: 'Installments', get: (r) => `${r.paid_installments}/${r.total_installments}` },
      visibleCols.status && { key: 'status', label: 'Status', get: (r) => r.status },
    ].filter(Boolean)

    const headerRow = colDefs.map((c) => c.label)
    const dataRows = loans.map((row, idx) => colDefs.map((c) => c.get(row, idx)))

    const csv =
      '\uFEFF' +
      [headerRow, ...dataRows]
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan_records_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleColumn = (key) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const columnOptions = [
    { key: 'sl_no', label: t('loans.slNo') },
    { key: 'rank', label: t('loans.rank') },
    { key: 'kgid', label: t('loans.kgid') },
    { key: 'station', label: t('loans.station') },
    { key: 'loan_type', label: t('loans.loanType') },
    { key: 'sanction_date', label: t('loans.sanctionDate') },
    { key: 'sanction_amount', label: t('loans.sanctionAmount') },
    { key: 'monthly_interest', label: t('loans.monthlyInterest') },
    { key: 'recovered', label: t('loans.recoveredAmount') },
    { key: 'outstanding', label: t('loans.outstandingBalance') },
    { key: 'installments', label: t('loans.installments') },
    { key: 'status', label: t('common.status') },
  ]

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="page-stack">
      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{t('loans.title')}</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-gov-primary rounded">
              {total} {t('loans.loanFiles')}
            </span>
          </span>
        }
        subtitle={t('loans.subtitle')}
        actions={
          <Button
            variant="success"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={openCreateLoan}
          >
            {t('loans.disburseNew')}
          </Button>
        }
      />

      {/* Toolbar: Search, Filters, New Loan, Columns Toggle, Export CSV */}
      <div className="section-card flex flex-wrap items-center gap-2 p-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-[1_1_260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('loans.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-sm border border-slate-300 py-2 pl-9 pr-8 text-sm focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Loan Type Filter */}
        <select
          value={loanTypeFilter}
          onChange={(e) => setLoanTypeFilter(e.target.value)}
          className="h-10 rounded-sm border border-slate-300 bg-white px-2.5 text-sm focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{t('loans.allLoanTypes')}</option>
          {LOAN_TYPES.map((lt) => (
            <option key={lt} value={lt}>{lt}</option>
          ))}
        </select>

        {/* Station Filter */}
        <select
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
          className="h-10 max-w-44 rounded-sm border border-slate-300 bg-white px-2.5 text-sm focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{t('loans.allStations')}</option>
          {stations.map((s) => (
            <option key={s.ps_id} value={s.ps_id}>{s.station_name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-sm border border-slate-300 bg-white px-2.5 text-sm focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{t('loans.allStatuses')}</option>
          {LOAN_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        {/* Action Buttons Group */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="success"
            size="md"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={openCreateLoan}
          >
            {t('loans.newLoan')}
          </Button>

          {/* Column Selector Dropdown */}
          <div className="relative" ref={colMenuRef}>
            <Button
              variant="outline"
              size="md"
              icon={<Columns3 className="w-4 h-4" />}
              onClick={() => setColMenuOpen(!colMenuOpen)}
            >
              {t('loans.columns')}
            </Button>

            {colMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded shadow-lg z-30 p-2 space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Toggle Table Columns
                </div>
                {columnOptions.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="accent-gov-primary"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV Button */}
          <Button
            variant="primary"
            size="md"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
            disabled={loans.length === 0}
          >
            {t('loans.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Operational Loan Records Table */}
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,41,66,0.06)]">
        <div className="table-scroll max-h-[calc(100vh-300px)] overflow-auto">
          <table className="w-full min-w-[940px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="border-b-2 border-amber-400 bg-gov-navy text-xs font-bold uppercase tracking-wide text-slate-100">
                {visibleCols.sl_no && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.slNo')}</th>}
                <th className="min-w-[150px] border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.officerName')}</th>
                {visibleCols.rank && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.rank')}</th>}
                {visibleCols.kgid && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.kgid')}</th>}
                {visibleCols.station && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.station')}</th>}
                {visibleCols.loan_type && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.loanType')}</th>}
                {visibleCols.sanction_date && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3">{t('loans.sanctionDate')}</th>}
                {visibleCols.sanction_amount && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-right">{t('loans.sanctionAmount')}</th>}
                {visibleCols.monthly_interest && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-right">{t('loans.monthlyInterest')}</th>}
                {visibleCols.recovered && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-right">{t('loans.recoveredAmount')}</th>}
                {visibleCols.outstanding && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-right">{t('loans.outstandingBalance')}</th>}
                {visibleCols.installments && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-center">{t('loans.installments')}</th>}
                {visibleCols.status && <th className="border-r border-white/10 whitespace-nowrap px-2.5 py-3 text-center">{t('common.status')}</th>}
                <th className="whitespace-nowrap px-2.5 py-3 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-7 h-7 border-4 border-gov-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium">{t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Inbox className="w-10 h-10 text-slate-300" />
                      <p className="text-sm font-medium">{t('loans.noRecordsFound')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                loans.map((loan, idx) => (
                  <tr
                    key={loan.loan_id}
                    onClick={() => openHistoryDrawer(loan)}
                    className="group cursor-pointer border-b border-slate-100 even:bg-slate-50/80 transition-colors hover:bg-blue-50/70"
                  >
                    {visibleCols.sl_no && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 text-xs text-slate-500 font-mono">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                    )}
                    <td className="max-w-[220px] border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 font-semibold text-slate-900">
                      {loan.full_name}
                    </td>
                    {visibleCols.rank && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 text-xs text-slate-700">{loan.designation}</td>
                    )}
                    {visibleCols.kgid && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 font-mono text-xs text-slate-700">{loan.kgid}</td>
                    )}
                    {visibleCols.station && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 text-xs text-slate-700">{loan.station_name}</td>
                    )}
                    {visibleCols.loan_type && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-xs font-medium text-slate-800">{loan.loan_type}</td>
                    )}
                    {visibleCols.sanction_date && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 text-xs text-slate-700">{loan.sanction_date}</td>
                    )}
                    {visibleCols.sanction_amount && (
                      <td className="border-r border-slate-100 whitespace-nowrap px-2.5 py-2.5 text-right font-semibold text-slate-900">
                        {formatINR(loan.sanction_amount)}
                      </td>
                    )}
                    {visibleCols.monthly_interest && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs text-slate-700">
                        <div>{formatINR(loan.monthly_interest)}</div>
                        {Number(loan.sanction_amount) > 0 && (
                          <div className="text-[10px] text-slate-400">
                            ({((Number(loan.monthly_interest) / Number(loan.sanction_amount)) * 100).toFixed(2)}%)
                          </div>
                        )}
                      </td>
                    )}
                    {visibleCols.recovered && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold text-green-700">
                        {formatINR(loan.total_recovered)}
                      </td>
                    )}
                    {visibleCols.outstanding && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold text-red-700">
                        {formatINR(loan.outstanding_balance)}
                      </td>
                    )}
                    {visibleCols.installments && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-center text-xs font-mono">
                        {loan.paid_installments}/{loan.total_installments}
                      </td>
                    )}
                    {visibleCols.status && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-center">
                        <span
                          className={
                            loan.status === 'Closed'
                              ? 'badge-active'
                              : loan.status === 'Active'
                              ? 'badge-pending'
                              : 'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-blue-100 text-blue-800'
                          }
                        >
                          {loan.status}
                        </span>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openHistoryDrawer(loan)}
                          className="p-1.5 text-gov-primary border border-slate-200 rounded hover:bg-blue-50 transition"
                          title={t('loans.tabRepaymentHistory')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {loan.status !== 'Closed' && (
                          <button
                            onClick={(e) => openPaymentModal(loan, null, e)}
                            className="p-1.5 text-green-700 border border-slate-200 rounded hover:bg-green-50 transition"
                            title={t('loans.recordPayment')}
                          >
                            <IndianRupee className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => openEditLoan(loan, e)}
                          className="p-1.5 text-indigo-600 border border-slate-200 rounded hover:bg-indigo-50 transition"
                          title={t('loans.editLoan')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {loan.document_attachment && (
                          <a
                            href={loanService.getAttachmentDownloadUrl(loan.loan_id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-amber-700 border border-slate-200 rounded hover:bg-amber-50 transition"
                            title={t('loans.downloadAttachment')}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 shadow-[0_-4px_12px_rgba(15,41,66,0.03)]">
            <div>
              {t('common.showingOf', { count: loans.length, total })}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-semibold bg-white border border-slate-300 rounded">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Disburse / Edit Loan Modal ────────────────────────────────────── */}
      <Modal
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        title={editingLoan ? t('loans.editLoan') : t('loans.disburseNew')}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={loanForm.handleSubmit(handleLoanSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label={t('loans.selectMember')}
              required
              disabled={Boolean(editingLoan)}
              options={members.map((m) => ({
                value: m.kgid,
                label: `${m.kgid} — ${m.full_name} (${m.designation})`,
              }))}
              error={loanForm.formState.errors.kgid?.message}
              {...loanForm.register('kgid', { required: t('validation.required') })}
            />

            <Select
              label={t('loans.station')}
              required
              options={stations.map((s) => ({ value: String(s.ps_id), label: s.station_name }))}
              error={loanForm.formState.errors.ps_id?.message}
              {...loanForm.register('ps_id', { required: t('validation.required') })}
            />

            <Select
              label={t('loans.loanType')}
              required
              options={LOAN_TYPES.map((lt) => ({ value: lt, label: lt }))}
              error={loanForm.formState.errors.loan_type?.message}
              {...loanForm.register('loan_type', { required: t('validation.required') })}
            />

            <Select
              label={t('common.status')}
              options={LOAN_STATUSES.map((st) => ({ value: st, label: st }))}
              {...loanForm.register('status')}
            />

            <Input
              label={t('loans.sanctionDate')}
              type="date"
              required
              error={loanForm.formState.errors.sanction_date?.message}
              {...loanForm.register('sanction_date', { required: t('validation.required') })}
            />

            <Input
              label={t('loans.sanctionAmount')}
              type="number"
              step="0.01"
              min="1"
              required
              placeholder="e.g. 350000"
              error={loanForm.formState.errors.sanction_amount?.message}
              {...loanForm.register('sanction_amount', { required: t('validation.required') })}
            />

            <Input
              label={t('loans.monthlyPrincipal')}
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 15000"
              error={loanForm.formState.errors.monthly_principal?.message}
              {...loanForm.register('monthly_principal', { required: t('validation.required') })}
            />

            <Input
              label={t('loans.monthlyInterestRate')}
              type="number"
              step="0.0001"
              min="0"
              max="100"
              required
              placeholder="e.g. 0.7083"
              helperText={`${t('loans.calculatedInterest')}: ${formatINR(calculatedMonthlyInterest)}`}
              error={loanForm.formState.errors.interest_rate?.message}
              {...loanForm.register('interest_rate', {
                required: t('validation.required'),
                min: { value: 0, message: t('validation.minValue', { n: 0 }) },
              })}
            />

            <Input
              label={t('loans.startMonth')}
              required
              placeholder="e.g. November 2026"
              error={loanForm.formState.errors.start_month?.message}
              {...loanForm.register('start_month', { required: t('validation.required') })}
            />

            <Input
              label={t('loans.endDate')}
              type="date"
              required
              error={loanForm.formState.errors.end_date?.message}
              {...loanForm.register('end_date', { required: t('validation.required') })}
            />

            <Input
              label={t('loans.totalInstallments')}
              type="number"
              min="1"
              max="360"
              required
              error={loanForm.formState.errors.total_installments?.message}
              {...loanForm.register('total_installments', { required: t('validation.required') })}
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                {t('loans.documentAttachment')}
              </label>
              <div className="flex flex-wrap items-center gap-3 p-3 border border-dashed border-slate-300 rounded bg-slate-50">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5 text-gov-primary" />
                  <span>{t('loans.uploadAttachment')}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setSelectedFile(file)
                    }}
                  />
                </label>

                {selectedFile ? (
                  <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : editingLoan?.document_attachment ? (
                  <a
                    href={loanService.getAttachmentDownloadUrl(editingLoan.loan_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gov-primary hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {t('loans.downloadAttachment')}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">{t('loans.attachmentAllowed')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setLoanModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={savingLoan}>
              {editingLoan ? t('common.saveChanges') : t('loans.disburseNew')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Record Payment Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={t('loans.recordPayment')}
        subtitle={
          paymentTargetLoan
            ? `${paymentTargetLoan.full_name} (KGID: ${paymentTargetLoan.kgid}) • Outstanding: ${formatINR(paymentTargetLoan.outstanding_balance)}`
            : ''
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
          <Input
            label={t('loans.recoveredAmount')}
            type="number"
            step="0.01"
            min="0"
            required
            error={paymentForm.formState.errors.recovered_amount?.message}
            {...paymentForm.register('recovered_amount', { required: t('validation.required') })}
          />

          <Input
            label={t('loans.interest')}
            type="number"
            step="0.01"
            min="0"
            required
            error={paymentForm.formState.errors.total_interest?.message}
            {...paymentForm.register('total_interest', { required: t('validation.required') })}
          />

          <Input
            label={t('loans.paymentDate')}
            type="date"
            required
            error={paymentForm.formState.errors.payment_date?.message}
            {...paymentForm.register('payment_date', { required: t('validation.required') })}
          />

          <Select
            label={t('common.status')}
            options={[
              { value: 'Paid', label: 'Paid' },
              { value: 'Partial', label: 'Partial' },
            ]}
            {...paymentForm.register('status')}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="success" loading={savingPayment}>
              {t('loans.recordPayment')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Officer Loan & Transactional History Drawer ───────────────────── */}
      <OfficerLoanDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kgid={drawerKgid}
        initialLoanId={drawerLoanId}
        onRecordPayment={(loan, refreshDrawer) => openPaymentModal(loan, refreshDrawer)}
      />
    </div>
  )
}
