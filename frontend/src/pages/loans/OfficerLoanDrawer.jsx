import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  X, Printer, Download, User, HandCoins, FileSpreadsheet,
  PlusCircle, Shield, CheckCircle2, Clock, Paperclip, Eye, Columns3
} from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import loanService from '../../services/loanService.js'

function formatINR(val) {
  if (val == null || val === '') return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function OfficerLoanDrawer({
  isOpen,
  onClose,
  kgid,
  initialLoanId = null,
  onRecordPayment,
}) {
  const { t } = useLanguage()
  const { error: toastError } = useToast()

  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('history') // 'membership' | 'loans' | 'history'
  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId)
  const [historyColumnsOpen, setHistoryColumnsOpen] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState({
    installment: true,
    payment_date: true,
    opening_advance: true,
    recovery: true,
    balance: true,
    interest: true,
    status: true,
  })
  const historyColumnsRef = useRef(null)

  const fetchHistory = useCallback(async () => {
    if (!kgid) return
    setLoading(true)
    try {
      const data = await loanService.getUserHistory(kgid)
      setHistory(data)
      if (initialLoanId) {
        setSelectedLoanId(initialLoanId)
      } else if (data?.loans?.length > 0) {
        setSelectedLoanId(data.loans[0].loan_id)
      }
    } catch (err) {
      toastError(err.message || t('common.errorFetch'))
    } finally {
      setLoading(false)
    }
  }, [kgid, initialLoanId])

  useEffect(() => {
    if (isOpen && kgid) {
      setActiveTab('history')
      fetchHistory()
    }
  }, [isOpen, kgid, fetchHistory])

  // Escape key close
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (attachmentPreview) {
          setAttachmentPreview(null)
        } else if (historyColumnsOpen) {
          setHistoryColumnsOpen(false)
        } else {
          onClose()
        }
      }
    }
    const handleOutside = (e) => {
      if (historyColumnsOpen && historyColumnsRef.current && !historyColumnsRef.current.contains(e.target)) {
        setHistoryColumnsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleOutside)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [isOpen, onClose, historyColumnsOpen, attachmentPreview])

  if (!isOpen) return null

  const user = history?.user
  const loans = history?.loans || []
  const allPayments = history?.payments || []

  const activeLoan = loans.find((l) => l.loan_id === selectedLoanId) || loans[0] || null
  const loanPayments = activeLoan
    ? allPayments.filter((p) => p.loan_id === activeLoan.loan_id)
    : allPayments

  const historyColumnOptions = [
    { key: 'installment', label: t('loans.installmentNo') },
    { key: 'payment_date', label: t('loans.paymentDate') },
    { key: 'opening_advance', label: t('loans.openingAdvance') },
    { key: 'recovery', label: t('loans.recovery') },
    { key: 'balance', label: t('loans.balance') },
    { key: 'interest', label: t('loans.interest') },
    { key: 'status', label: t('common.status') },
  ]

  const formatNumberForPdf = (val) => {
    if (val == null || val === '') return '-'
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatINRForPdf = (val) => {
    if (val == null || val === '') return '-'
    return `INR ${formatNumberForPdf(val)}`
  }

  const openingAdvanceTotal = (() => {
    let runningAdvance = activeLoan ? Number(activeLoan.sanction_amount || 0) : 0
    let total = 0
    loanPayments.forEach((payment) => {
      total += runningAdvance
      runningAdvance = Number(payment.balance || 0)
    })
    return total
  })()

  const getHistoryTotals = () => ({
    installment: loanPayments.length,
    payment_date: '',
    opening_advance: openingAdvanceTotal,
    recovery: loanPayments.reduce((sum, payment) => sum + Number(payment.recovered_amount || 0), 0),
    balance: activeLoan ? Number(activeLoan.outstanding_balance || 0) : 0,
    interest: loanPayments.reduce((sum, payment) => sum + Number(payment.total_interest || 0), 0),
    status: '',
  })

  const getHistoryRows = () => {
    let runningAdvance = activeLoan ? Number(activeLoan.sanction_amount) : 0
    return loanPayments.map((payment, idx) => {
      const openingAdvance = runningAdvance
      runningAdvance = Number(payment.balance)
      return {
        installment: idx + 1,
        payment_date: payment.payment_date,
        opening_advance: formatNumberForPdf(openingAdvance),
        recovery: formatNumberForPdf(payment.recovered_amount),
        balance: formatNumberForPdf(payment.balance),
        interest: formatNumberForPdf(payment.total_interest),
        status: payment.status,
      }
    })
  }

  // Export officer's transactional history to CSV
  const handleDownloadHistoryCSV = () => {
    if (!user) return
    const selectedColumns = historyColumnOptions.filter((column) => visibleHistoryColumns[column.key])
    const headers = selectedColumns.map((column) => column.label)
    const historyRows = getHistoryRows()
    const totals = getHistoryTotals()
    const rows = historyRows.map((row) => selectedColumns.map((column) => row[column.key]))
    const totalRow = selectedColumns.map((column) => {
      if (column.key === 'opening_advance') return formatNumberForPdf(totals.opening_advance)
      if (column.key === 'recovery') return formatNumberForPdf(totals.recovery)
      if (column.key === 'balance') return formatNumberForPdf(totals.balance)
      if (column.key === 'interest') return formatNumberForPdf(totals.interest)
      if (column.key === 'installment') return `Total: ${totals.installment}`
      return column.key === 'payment_date' ? '' : totals.status
    })

    const csvContent =
      '\uFEFF' +
      [
        [`Officer: ${user.full_name}`, `KGID: ${user.kgid}`, `Rank: ${user.designation}`, `Station: ${user.station_name}`],
        [],
        headers,
        ...rows,
        totalRow,
      ]
        .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `loan_history_${user.kgid}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Generate a compact vertical A4 loan report.
  const handlePrint = async () => {
    if (!user || !activeLoan) return
    if (Object.values(visibleHistoryColumns).every((visible) => !visible)) {
      toastError('Select at least one column before generating the PDF.')
      return
    }
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()

      pdf.setDrawColor(80, 80, 80)
      pdf.setLineWidth(0.5)
      pdf.line(36, 68, pageWidth - 36, 68)
      pdf.setTextColor(20, 20, 20)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text('POLICE CREDIT CO-OPERATIVE SOCIETY', 36, 30)
      pdf.setFontSize(10)
      pdf.text('Official Loan & Transactional Record', 36, 48)
      pdf.setFontSize(9)
      pdf.text(`KGID: ${user.kgid}`, pageWidth - 36, 48, { align: 'right' })
      pdf.setFontSize(8)
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 36, 62, { align: 'right' })
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(16)
      pdf.text(user.full_name, 36, 102)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(55, 55, 55)
      pdf.text(`${user.designation || '-'} | ${user.station_name || '-'}`, 36, 118)

      const summaryRows = [
        [
          'Loan Scheme', activeLoan.loan_type || '-',
          'Sanction Amount', formatINRForPdf(activeLoan.sanction_amount),
        ],
        [
          'Monthly Principal', formatINRForPdf(activeLoan.monthly_principal),
          'Monthly Interest', formatINRForPdf(activeLoan.monthly_interest),
        ],
        [
          'Installments', `${activeLoan.paid_installments || 0} / ${activeLoan.total_installments || 0}`,
          'Outstanding', formatINRForPdf(activeLoan.outstanding_balance),
        ],
        [
          'Payment Start', activeLoan.start_month || '-',
          'End Date', activeLoan.end_date || '-',
        ],
      ]
      autoTable(pdf, {
        startY: 132,
        head: [['Loan Information', 'Details', 'Loan Information', 'Details']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: 'bold', lineWidth: 0.25, lineColor: [120, 120, 120] },
        columnStyles: {
          0: { cellWidth: 90, fontStyle: 'bold', textColor: [45, 45, 45] },
          1: { cellWidth: 160 },
          2: { cellWidth: 90, fontStyle: 'bold', textColor: [45, 45, 45] },
          3: { cellWidth: 160 },
        },
        styles: { fontSize: 8.5, cellPadding: 5, overflow: 'linebreak', valign: 'middle', textColor: [20, 20, 20], lineWidth: 0.25, lineColor: [180, 180, 180] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        margin: { left: 36, right: 36 },
      })

      const selectedColumns = historyColumnOptions.filter((column) => visibleHistoryColumns[column.key])
      const historyRows = getHistoryRows()
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 24,
        head: [selectedColumns.map((column) => column.label)],
        body: [
          ...historyRows.map((row) => selectedColumns.map((column) => String(row[column.key] ?? ''))),
          selectedColumns.map((column) => {
            const totals = getHistoryTotals()
            if (column.key === 'opening_advance') return formatNumberForPdf(totals.opening_advance)
            if (column.key === 'recovery') return formatNumberForPdf(totals.recovery)
            if (column.key === 'balance') return formatNumberForPdf(totals.balance)
            if (column.key === 'interest') return formatNumberForPdf(totals.interest)
            if (column.key === 'installment') return `Total: ${totals.installment}`
            return ''
          }),
        ],
        foot: [],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak', halign: 'left', textColor: [20, 20, 20], lineWidth: 0.25, lineColor: [180, 180, 180] },
        headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: 'bold', lineWidth: 0.25, lineColor: [120, 120, 120] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        didParseCell: (data) => {
          if (data.row.section === 'body' && data.row.index === historyRows.length) {
            data.cell.styles.fillColor = [245, 245, 245]
            data.cell.styles.textColor = [20, 20, 20]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.lineWidth = 0.3
            data.cell.styles.lineColor = [120, 120, 120]
          }
        },
        margin: { left: 36, right: 36 },
      })

      const pageCount = pdf.getNumberOfPages()
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page)
        pdf.setFontSize(8)
        pdf.setTextColor(80, 80, 80)
        pdf.text('SP Office - Police Credit Co-operative Society Records', 36, pdf.internal.pageSize.getHeight() - 24)
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - 36, pdf.internal.pageSize.getHeight() - 24, { align: 'right' })
      }

      pdf.save(`loan_report_${user.kgid}_loan_${activeLoan.loan_id}.pdf`)
    } catch (err) {
      toastError(err.message || 'Could not generate PDF report.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-8">
        <div className="w-screen max-w-4xl bg-white shadow-2xl flex flex-col border-l border-slate-300">

          {/* Dark Navy Official Header */}
          <div className="bg-gov-navy text-white px-6 py-4 flex items-start justify-between border-b-4 border-gov-primary">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">
                  {t('loans.historyDrawerTitle')}
                </p>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {user ? user.full_name.toUpperCase() : `KGID: ${kgid}`}
                </h2>
                {user && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    {user.designation} • {user.station_name} • KGID: {user.kgid}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="p-2 rounded text-slate-300 hover:text-white hover:bg-white/10 transition"
                title={t('loans.printSavePdf')}
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded text-slate-300 hover:text-white hover:bg-white/10 transition"
                title={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('membership')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === 'membership'
                  ? 'border-gov-primary text-gov-primary bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              {t('loans.tabMembership')}
            </button>

            <button
              onClick={() => setActiveTab('loans')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === 'loans'
                  ? 'border-gov-primary text-gov-primary bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <HandCoins className="w-4 h-4" />
              {t('loans.tabLoans')} ({loans.length})
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-gov-primary text-gov-primary bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('loans.tabRepaymentHistory')} ({allPayments.length})
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {loading ? (
              <Loading text={t('common.loading')} />
            ) : !user ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                {t('common.noRecords')}
              </div>
            ) : activeTab === 'membership' ? (
              /* ── TAB 1: Officer Membership & Details ─────────────────── */
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-2.5">
                    <h4 className="text-xs font-bold text-gov-primary uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      {t('members.sectionPersonal')}
                    </h4>
                    <DetailItem label={t('members.kgid')} value={user.kgid} mono />
                    <DetailItem label={t('members.fullName')} value={user.full_name} />
                    <DetailItem label={t('members.dob')} value={user.dob} />
                    <DetailItem label={t('members.gender')} value={user.gender} />
                    <DetailItem label={t('members.caste')} value={user.caste || '—'} />
                    <DetailItem label={t('members.subCaste')} value={user.sub_caste || '—'} />
                    <DetailItem label={t('members.category')} value={user.category || '—'} />
                  </div>

                  <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-2.5">
                    <h4 className="text-xs font-bold text-gov-primary uppercase tracking-wider border-b border-slate-200 pb-1.5">
                      {t('members.sectionEmployment')} & {t('members.sectionBanking')}
                    </h4>
                    <DetailItem label={t('members.designation')} value={user.designation} />
                    <DetailItem label={t('members.station')} value={user.station_name} />
                    <DetailItem label={t('members.shareNo')} value={user.share_number || '—'} />
                    <DetailItem label={t('members.buckleNo')} value={user.buckle_number || '—'} />
                    <DetailItem label={t('members.financialYear')} value={user.financial_year} />
                    <DetailItem label={t('members.bankAccount')} value={user.bank_account_number} mono />
                    <DetailItem label={t('members.ifsc')} value={user.ifsc_code} mono />
                  </div>
                </div>
              </div>
            ) : activeTab === 'loans' ? (
              /* ── TAB 2: All Loans of This Officer ────────────────────── */
              <div className="space-y-4">
                {loans.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">{t('loans.noRecordsFound')}</p>
                ) : (
                  loans.map((loan) => (
                    <div
                      key={loan.loan_id}
                      className={`border rounded p-4 transition ${
                        activeLoan?.loan_id === loan.loan_id
                          ? 'border-gov-primary bg-blue-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                              #{loan.loan_id}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{loan.loan_type}</h4>
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
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {t('loans.sanctionDate')}: {loan.sanction_date} • {t('loans.startMonth')}: {loan.start_month} • {t('loans.endDate')}: {loan.end_date}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {loan.document_attachment && (
                            <>
                              <button
                                type="button"
                                onClick={() => setAttachmentPreview({ loanId: loan.loan_id, loanType: loan.loan_type })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Document
                              </button>
                              <a
                                href={loanService.getAttachmentDownloadUrl(loan.loan_id)}
                                download
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </a>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLoanId(loan.loan_id)
                              setActiveTab('history')
                            }}
                          >
                            {t('loans.tabRepaymentHistory')}
                          </Button>
                          {onRecordPayment && loan.status !== 'Closed' && (
                            <Button
                              size="sm"
                              variant="success"
                              icon={<PlusCircle className="w-3.5 h-3.5" />}
                              onClick={() => onRecordPayment(loan, fetchHistory)}
                            >
                              {t('loans.recordPayment')}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                        <div>
                          <span className="text-slate-500 block">{t('loans.sanctionAmount')}</span>
                          <span className="font-bold text-slate-900 text-sm">{formatINR(loan.sanction_amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('loans.recoveredAmount')}</span>
                          <span className="font-bold text-green-700 text-sm">{formatINR(loan.total_recovered)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('loans.outstandingBalance')}</span>
                          <span className="font-bold text-red-700 text-sm">{formatINR(loan.outstanding_balance)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('loans.installments')}</span>
                          <span className="font-bold text-slate-900 text-sm">
                            {loan.paid_installments} / {loan.total_installments}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* ── TAB 3: Transactional History & Repayment Schedule ───── */
              <div className="space-y-5">
                {/* Header row with Loan Selector & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('loans.repaymentScheduleTitle')}
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">{user.full_name}</h3>
                    <p className="text-xs text-slate-500">
                      KGID: {user.kgid} • {user.designation} • {user.station_name}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {loans.length > 1 && (
                      <select
                        value={activeLoan?.loan_id || ''}
                        onChange={(e) => setSelectedLoanId(Number(e.target.value))}
                        className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-medium bg-white"
                      >
                        {loans.map((l) => (
                          <option key={l.loan_id} value={l.loan_id}>
                            Loan #{l.loan_id} – {l.loan_type} ({formatINR(l.sanction_amount)})
                          </option>
                        ))}
                      </select>
                    )}

                    {onRecordPayment && activeLoan && activeLoan.status !== 'Closed' && (
                      <Button
                        size="sm"
                        variant="success"
                        icon={<PlusCircle className="w-3.5 h-3.5" />}
                        onClick={() => onRecordPayment(activeLoan, fetchHistory)}
                      >
                        {t('loans.recordPayment')}
                      </Button>
                    )}

                    <div ref={historyColumnsRef} className="relative">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Columns3 className="w-3.5 h-3.5" />}
                        onClick={() => setHistoryColumnsOpen((open) => !open)}
                        aria-expanded={historyColumnsOpen}
                        aria-haspopup="true"
                      >
                        Columns
                      </Button>
                      {historyColumnsOpen && (
                        <div className="absolute right-0 z-40 mt-1 max-h-72 w-56 overflow-y-auto rounded border border-slate-200 bg-white p-3 shadow-lg">
                          <p className="mb-2 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase text-slate-500">
                            Visible columns
                          </p>
                          {historyColumnOptions.map((column) => (
                            <label key={column.key} className="flex cursor-pointer items-center gap-2 py-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={visibleHistoryColumns[column.key]}
                                onChange={() => setVisibleHistoryColumns((current) => ({
                                  ...current,
                                  [column.key]: !current[column.key],
                                }))}
                                className="h-4 w-4 accent-gov-primary"
                              />
                              {column.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={handleDownloadHistoryCSV}
                      disabled={Object.values(visibleHistoryColumns).every((visible) => !visible)}
                    >
                      {t('loans.exportCsv')}
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Printer className="w-3.5 h-3.5" />}
                      onClick={handlePrint}
                      disabled={Object.values(visibleHistoryColumns).every((visible) => !visible)}
                    >
                      {t('loans.printSavePdf')}
                    </Button>

                    {activeLoan?.document_attachment && (
                      <button
                        type="button"
                        onClick={() => setAttachmentPreview({ loanId: activeLoan.loan_id, loanType: activeLoan.loan_type })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Document
                      </button>
                    )}
                  </div>
                </div>

                {/* Loan Summary Strip (matching reference Image 2) */}
                {activeLoan && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.loanType')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{activeLoan.loan_type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.sanctionAmount')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{formatINR(activeLoan.sanction_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.monthlyPrincipal')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{formatINR(activeLoan.monthly_principal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.monthlyInterestRate')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {Number(activeLoan.sanction_amount) > 0
                          ? `${((Number(activeLoan.monthly_interest) / Number(activeLoan.sanction_amount)) * 100).toFixed(4).replace(/\.?0+$/, '')}% (${formatINR(activeLoan.monthly_interest)})`
                          : formatINR(activeLoan.monthly_interest)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.installments')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {activeLoan.paid_installments} / {activeLoan.total_installments}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.startMonth')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{activeLoan.start_month}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.endDate')}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{activeLoan.end_date}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        {t('loans.outstandingBalance')}
                      </span>
                      <span className="font-bold text-red-700 text-sm">
                        {formatINR(activeLoan.outstanding_balance)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transactional History Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200 shadow-[0_6px_18px_rgba(15,41,66,0.05)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-amber-400 bg-gov-navy text-slate-100 font-bold uppercase">
                          {visibleHistoryColumns.installment && <th className="border-r border-white/10 px-2.5 py-3">{t('loans.installmentNo')}</th>}
                          {visibleHistoryColumns.payment_date && <th className="border-r border-white/10 px-2.5 py-3">{t('loans.paymentDate')}</th>}
                          {visibleHistoryColumns.opening_advance && <th className="border-r border-white/10 px-2.5 py-3 text-right">{t('loans.openingAdvance')}</th>}
                          {visibleHistoryColumns.recovery && <th className="border-r border-white/10 px-2.5 py-3 text-right">{t('loans.recovery')}</th>}
                          {visibleHistoryColumns.balance && <th className="border-r border-white/10 px-2.5 py-3 text-right">{t('loans.balance')}</th>}
                          {visibleHistoryColumns.interest && <th className="border-r border-white/10 px-2.5 py-3 text-right">{t('loans.interest')}</th>}
                          {visibleHistoryColumns.status && <th className="px-2.5 py-3 text-center">{t('common.status')}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {loanPayments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                              {t('loans.noPaymentsYet')}
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            let openingBalance = activeLoan ? Number(activeLoan.sanction_amount) : 0
                            return loanPayments.map((pay, idx) => {
                              const currentAdvance = openingBalance
                              openingBalance = Number(pay.balance)
                              return (
                                <tr key={pay.pay_id} className="border-b border-slate-100 even:bg-slate-50/80 hover:bg-blue-50/70">
                                  {visibleHistoryColumns.installment && <td className="border-r border-slate-100 px-2.5 py-2.5 font-mono font-semibold text-slate-700">{idx + 1}</td>}
                                  {visibleHistoryColumns.payment_date && <td className="border-r border-slate-100 px-2.5 py-2.5 text-slate-700">{pay.payment_date}</td>}
                                  {visibleHistoryColumns.opening_advance && <td className="border-r border-slate-100 px-2.5 py-2.5 text-right font-medium text-slate-800">{formatINR(currentAdvance)}</td>}
                                  {visibleHistoryColumns.recovery && <td className="border-r border-slate-100 px-2.5 py-2.5 text-right font-semibold text-green-700">{formatINR(pay.recovered_amount)}</td>}
                                  {visibleHistoryColumns.balance && <td className="border-r border-slate-100 px-2.5 py-2.5 text-right font-semibold text-slate-900">{formatINR(pay.balance)}</td>}
                                  {visibleHistoryColumns.interest && <td className="border-r border-slate-100 px-2.5 py-2.5 text-right text-slate-700">{formatINR(pay.total_interest)}</td>}
                                  {visibleHistoryColumns.status && (
                                    <td className="px-2.5 py-2.5 text-center">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-green-100 text-green-800">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {pay.status}
                                      </span>
                                    </td>
                                  )}
                                </tr>
                              )
                            })
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

      {attachmentPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setAttachmentPreview(null)}
          />
          <div className="relative flex h-[min(88vh,850px)] w-[min(92vw,1100px)] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-gov-navy px-5 py-3 text-white">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-amber-300">Loan Document Preview</p>
                <p className="truncate text-sm font-semibold">
                  {user?.full_name} • {attachmentPreview.loanType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="ml-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-200 hover:bg-white/10 hover:text-white"
                aria-label="Close document preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              <iframe
                src={loanService.getAttachmentViewUrl(attachmentPreview.loanId)}
                title="Loan document preview"
                className="h-full w-full border-0"
              />
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="rounded-sm border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

          {/* Drawer Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              SP Office – Police Credit Co-operative Society Records
            </span>
            <Button variant="primary" size="sm" onClick={onClose}>
              {t('loans.closeRecord')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}:</span>
      <span className={`font-semibold text-slate-900 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}
