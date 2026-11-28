import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  X, Printer, Download, User, Briefcase, HandCoins, FileSpreadsheet, FileText,
  PlusCircle, Shield, CheckCircle2, Clock, Paperclip, Eye, Columns3, Landmark, Pencil
} from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import Modal from '../../components/common/Modal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import loanService from '../../services/loanService.js'
import memberService from '../../services/memberService.js'
import MemberCreate from '../members/MemberCreate.jsx'

function formatINR(val) {
  if (val == null || val === '') return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatLedgerDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatSubscriptionPeriod(year, month) {
  if (!year || !month) return '—'
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function getScheduleMonth(startMonth, installmentOffset) {
  const start = String(startMonth || '').trim()
  const nameMatch = start.match(/^([A-Za-z]+)\s+(\d{4})$/)
  const isoMatch = start.match(/^([0-9]{4})[-/]([0-9]{1,2})/)
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  let year = 0
  let monthIndex = -1

  if (isoMatch) {
    year = Number(isoMatch[1])
    monthIndex = Number(isoMatch[2]) - 1
  } else if (nameMatch) {
    year = Number(nameMatch[2])
    const name = nameMatch[1].replace(/\.$/, '')
    monthIndex = monthNames.findIndex((item) => item.toLowerCase() === name.toLowerCase() || item.slice(0, 3).toLowerCase() === name.slice(0, 3).toLowerCase())
  }

  if (year <= 0 || monthIndex < 0) return null
  const date = new Date(year, monthIndex + installmentOffset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function OfficerLoanDrawer({
  isOpen,
  onClose,
  kgid,
  initialLoanId = null,
  initialTab = 'history',
  onRecordPayment,
}) {
  const { t } = useLanguage()
  const { error: toastError } = useToast()

  const [history, setHistory] = useState(null)
  const [memberDocuments, setMemberDocuments] = useState([])
  const [membershipRecords, setMembershipRecords] = useState([])
  const [membershipFeeTier, setMembershipFeeTier] = useState(null)
  const [loading, setLoading] = useState(false)
  const [markingDueInstallment, setMarkingDueInstallment] = useState(null)
  const [memberDocumentLoading, setMemberDocumentLoading] = useState(null)
  const [memberDocumentPreview, setMemberDocumentPreview] = useState(null)
  const [memberEditOpen, setMemberEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab) // 'membership' | 'loans' | 'history'
  const [selectedLoanId, setSelectedLoanId] = useState(initialLoanId)
  const [historyColumnsOpen, setHistoryColumnsOpen] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState({
    installment: true,
    payment_date: true,
    opening_advance: true,
    recovery: true,
    balance: true,
    interest_year: true,
    interest_month: true,
    payable_amount: true,
    paid_interest: true,
    paid_amount: true,
    status: true,
  })
  const historyColumnsRef = useRef(null)

  const fetchHistory = useCallback(async () => {
    if (!kgid) return
    setLoading(true)
    try {
      const [data, documents, feeResponse, records] = await Promise.all([
        loanService.getUserHistory(kgid),
        memberService.getMemberDocuments(kgid).catch(() => []),
        memberService.getFeeTiers().catch(() => null),
        memberService.getMembershipRecords(kgid).catch(() => []),
      ])
      setHistory(data)
      setMemberDocuments(documents)
      setMembershipRecords(Array.isArray(records) ? records : [])
      const feeTiers = feeResponse?.items ?? feeResponse?.data ?? feeResponse ?? []
      setMembershipFeeTier(feeTiers.find((tier) => Number(tier.mf_id) === Number(data?.user?.mf_id)) ?? null)
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
    if (!memberDocumentPreview?.url) return undefined
    return () => URL.revokeObjectURL(memberDocumentPreview.url)
  }, [memberDocumentPreview])

  const handleMarkDue = async (installmentNumber) => {
    if (!activeLoan) return
    setMarkingDueInstallment(installmentNumber)
    try {
      await loanService.recordPayment(activeLoan.loan_id, {
        installment_number: installmentNumber,
        paid_amount: 0,
        payment_date: new Date().toISOString().slice(0, 10),
        is_paid: false,
        status: 'Due',
      })
      await fetchHistory()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setMarkingDueInstallment(null)
    }
  }

  const handleViewMemberDocument = async (item) => {
    setMemberDocumentLoading(item.doc_id)
    try {
      const blob = await memberService.downloadMemberDocument(user.kgid, item.doc_id)
      setMemberDocumentPreview({
        name: item.original_filename || `Document ${item.doc_id}`,
        url: URL.createObjectURL(blob),
      })
    } catch (err) {
      toastError(err.message || t('members.viewDocumentError'))
    } finally {
      setMemberDocumentLoading(null)
    }
  }

  const handleDownloadMemberDocument = async (item) => {
    try {
      const blob = await memberService.downloadMemberDocument(user.kgid, item.doc_id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.original_filename || `member-document-${item.doc_id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toastError(err.message || t('members.downloadDocumentError'))
    }
  }

  useEffect(() => {
    if (isOpen && kgid) {
      setActiveTab(initialTab)
      fetchHistory()
    }
  }, [isOpen, kgid, initialTab, fetchHistory])

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
  const monthlySubscriptionAmount = Number(membershipFeeTier?.share_subscription_fee ?? 0)
  const loans = history?.loans || []
  const allPayments = history?.payments || []
  const membershipAssignments = membershipRecords.filter((record) => record.record_type === 'membership')
  const assignmentById = new Map(membershipAssignments.map((record) => [record.record_id, record]))
  const shareTransactions = membershipRecords
    .filter((record) => record.record_type === 'subscription')
    .sort((left, right) => (right.transaction_date || '').localeCompare(left.transaction_date || ''))
  const contributionMonths = shareTransactions.length
  const accumulatedShareAmount = shareTransactions.length
    ? shareTransactions.reduce((total, record) => total + Number(record.amount || 0), 0)
    : null
  const earliestMembership = [...membershipAssignments]
    .sort((left, right) => (left.effective_from || '').localeCompare(right.effective_from || ''))[0]
  const membershipStarted = earliestMembership?.effective_from || user?.membership_start_date

  const activeLoan = loans.find((l) => l.loan_id === selectedLoanId) || loans[0] || null
  const loanPayments = activeLoan
    ? allPayments.filter((p) => p.loan_id === activeLoan.loan_id)
    : allPayments

  const historyColumnOptions = [
    { key: 'installment', label: 'No. of installment' },
    { key: 'payment_date', label: 'Month' },
    { key: 'opening_advance', label: 'Advance' },
    { key: 'recovery', label: 'Recovery' },
    { key: 'balance', label: 'Balance' },
    { key: 'interest_year', label: 'Interest per Year' },
    { key: 'interest_month', label: 'Interest per month' },
    { key: 'payable_amount', label: 'Payable Amount' },
    { key: 'paid_interest', label: 'Paid Interest' },
    { key: 'paid_amount', label: 'Paid Amount' },
    { key: 'status', label: 'Payment Status' },
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

  const getAnnualRatePercent = () => {
    if (!activeLoan) return 0
    if (Number(activeLoan.interest_rate || 0) > 0) {
      return Number(activeLoan.interest_rate)
    }

    const sanctionAmount = Number(activeLoan.sanction_amount || 0)
    const storedMonthlyInterest = Number(activeLoan.monthly_interest || 0)
    return sanctionAmount > 0
      ? (storedMonthlyInterest * 12 * 100) / sanctionAmount
      : 0
  }

  const getHistoryTotals = () => {
    const scheduleRows = getHistoryRows()
    const plannedRecovery = scheduleRows.reduce((sum, row) => sum + Number(String(row.recovery).replace(/,/g, '') || 0), 0)
    const plannedInterest = scheduleRows.reduce((sum, row) => sum + Number(String(row.interest_month).replace(/,/g, '') || 0), 0)
    const receivedRows = loanPayments.filter((payment) => payment.is_paid)
    const recovery = receivedRows.reduce((sum, payment) => sum + Number(payment.recovered_amount || 0), 0)
    const interest = receivedRows.reduce((sum, payment) => sum + Number(payment.total_interest || 0), 0)
    const totalInstallments = scheduleRows.length || Number(activeLoan?.total_installments || 0)

    return {
      installment: totalInstallments,
      payment_date: '',
      opening_advance: openingAdvanceTotal,
      recovery,
      balance: activeLoan ? Number(activeLoan.outstanding_balance || 0) : 0,
      interest,
      plannedRecovery,
      plannedInterest,
      averageInterest: totalInstallments > 0 ? plannedInterest / totalInstallments : 0,
      withInterest: recovery + interest,
      status: '',
    }
  }

  const getHistoryRows = () => {
    if (!activeLoan) return []

    const sanctionAmount = Number(activeLoan.sanction_amount || 0)
    const annualRatePercent = Number(activeLoan.interest_rate || 0) > 0
      ? Number(activeLoan.interest_rate)
      : getAnnualRatePercent()
    const firstUnpaidInstallment = loanPayments.find((payment) => !payment.is_paid)?.installment_number
    let openingBalance = sanctionAmount

    return loanPayments.map((payment, index) => {
      const installment = Number(payment.installment_number || index + 1)
      const scheduleMonth = getScheduleMonth(activeLoan.start_month, installment - 1)
      const openingAdvance = Number(payment.opening_advance || openingBalance)
      const recovery = Number(payment.recovered_amount || 0)
      const balance = Number(payment.balance || 0)
      const paidInterest = payment.is_paid ? Number(payment.total_interest || 0) : 0
      const interestPerMonth = (openingAdvance * annualRatePercent) / 1200
      const interestPerYear = (openingAdvance * annualRatePercent) / 100
      const paidAmount = recovery + paidInterest

      openingBalance = balance

      return {
        installment,
        payment_date: scheduleMonth
          ? new Date(`${scheduleMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
          : '-',
        schedule_month: scheduleMonth,
        opening_advance: formatNumberForPdf(openingAdvance),
        recovery: formatNumberForPdf(recovery),
        balance: formatNumberForPdf(balance),
        interest_year: formatNumberForPdf(interestPerYear),
        interest_month: formatNumberForPdf(interestPerMonth),
        payable_amount: formatNumberForPdf(paidAmount),
        paid_interest: formatNumberForPdf(paidInterest),
        paid_amount: formatNumberForPdf(paidAmount),
        status: payment.is_paid
          ? 'Paid'
          : payment.status === 'Due'
            && installment === firstUnpaidInstallment
          ? 'Due'
          : payment.status === 'Not Received' ? 'Not Received' : 'Projected',
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
      if (column.key === 'interest_year') return formatNumberForPdf(totals.interest)
      if (column.key === 'interest_month') return formatNumberForPdf(totals.interest)
      if (column.key === 'payable_amount') return formatNumberForPdf(totals.recovery + totals.interest)
      if (column.key === 'paid_interest') return formatNumberForPdf(totals.interest)
      if (column.key === 'paid_amount') return formatNumberForPdf(totals.recovery + totals.interest)
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

      const totals = getHistoryTotals()

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

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 18,
        head: [['Schedule Summary', 'Amount']],
        body: [
          ['Total Principal Recovered', formatINRForPdf(totals.recovery)],
          ['Total Cutoff Interest', formatINRForPdf(totals.interest)],
          ['Monthly Average Interest', formatINRForPdf(totals.averageInterest)],
          ['Total Recovered with Interest', formatINRForPdf(totals.withInterest)],
        ],
        theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 5, textColor: [20, 20, 20], lineWidth: 0.25, lineColor: [180, 180, 180] },
        headStyles: { fillColor: [255, 255, 255], textColor: [20, 20, 20], fontStyle: 'bold', lineWidth: 0.25, lineColor: [120, 120, 120] },
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
            if (column.key === 'interest_year') return formatNumberForPdf(totals.interest)
            if (column.key === 'interest_month') return formatNumberForPdf(totals.interest)
            if (column.key === 'payable_amount') return formatNumberForPdf(totals.withInterest)
            if (column.key === 'paid_interest') return formatNumberForPdf(totals.interest)
            if (column.key === 'paid_amount') return formatNumberForPdf(totals.withInterest)
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
        <div className="w-screen max-w-6xl bg-white shadow-2xl flex flex-col border-l border-slate-300">

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
              onClick={() => setActiveTab('shares')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                activeTab === 'shares'
                  ? 'border-gov-primary text-gov-primary bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t('loans.tabShareTransactions')} ({shareTransactions.length})
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
              <div className="space-y-4">
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-gov-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">{user.full_name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {user.designation || '—'} · {user.station_name || activeLoan?.station_name || '—'} · KGID {user.kgid}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={user.status === 'Active' ? 'badge-active' : 'badge-inactive'}>{user.status}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => setMemberEditOpen(true)}
                    >
                      {t('members.editMember')}
                    </Button>
                  </div>
                </section>

                <section className="overflow-hidden rounded-md border border-amber-200 bg-amber-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-amber-900">Police Credit Co-operative Society Records</p>
                      <p className="mt-0.5 text-xs text-slate-600">Membership record, shareholding and subscription ledger</p>
                    </div>
                    <span className="rounded-sm bg-white px-2 py-1 text-xs font-semibold text-gov-primary">Tier {user.mf_id}{membershipFeeTier?.description ? ` · ${membershipFeeTier.description}` : ''}</span>
                  </div>
                </section>

                <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Member Identification</h4>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-6 px-5 py-1 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem label="Official Name" value={user.full_name} />
                    <DetailItem label={t('members.kgid')} value={user.kgid} mono />
                    <DetailItem label={t('members.designation')} value={user.designation} />
                    <DetailItem label={t('members.station')} value={user.station_name || activeLoan?.station_name} />
                  </dl>
                </section>

                <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gov-primary">Shareholding &amp; Subscription Ledger</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Calculated from the assigned fee tier and membership start month.</p>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
                    <LedgerMetric label={t('members.membershipStarted')} value={formatLedgerDate(membershipStarted)} />
                    <LedgerMetric label={t('members.shareNo')} value={user.share_number || '—'} />
                    <LedgerMetric label={t('members.monthlySubscriptionAmount')} value={membershipFeeTier ? formatINR(monthlySubscriptionAmount) : t('members.feeTierUnavailable')} emphasis />
                    <LedgerMetric label={t('members.contributionMonths')} value={contributionMonths === null ? '—' : t('members.monthsCount', { count: contributionMonths })} />
                    <LedgerMetric label={t('members.totalShareAmount')} value={accumulatedShareAmount === null || !membershipFeeTier ? '—' : formatINR(accumulatedShareAmount)} emphasis />
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <DetailSection icon={User} title={t('members.sectionPersonal')}>
                    <DetailItem label={t('members.dob')} value={user.dob} />
                    <DetailItem label={t('members.gender')} value={user.gender} />
                    <DetailItem label={t('members.caste')} value={user.caste} />
                    <DetailItem label={t('members.subCaste')} value={user.sub_caste} />
                    <DetailItem label={t('members.category')} value={user.category} />
                  </DetailSection>

                  <DetailSection icon={Briefcase} title={t('members.sectionEmployment')}>
                    <DetailItem label={t('members.designation')} value={user.designation} />
                    <DetailItem label={t('members.station')} value={user.station_name || activeLoan?.station_name} />
                    <DetailItem label={t('members.shareNo')} value={user.share_number} />
                    <DetailItem label={t('members.buckleNo')} value={user.buckle_number} />
                  </DetailSection>

                  <DetailSection icon={HandCoins} title={t('members.sectionMembership')}>
                    <DetailItem label={t('members.feeTier')} value={membershipFeeTier?.description ? `${t('members.feeTier')} ${user.mf_id} — ${membershipFeeTier.description}` : user.mf_id} />
                    <DetailItem label={t('members.financialYear')} value={user.financial_year} />
                    <DetailItem label={t('members.financialMonth')} value={user.financial_month} />
                    <DetailItem label={t('members.shareFee')} value={membershipFeeTier ? formatINR(membershipFeeTier.share_fee) : '—'} />
                    <DetailItem label={t('members.membershipFee')} value={membershipFeeTier ? formatINR(membershipFeeTier.membership_fee) : '—'} />
                  </DetailSection>

                  <DetailSection icon={Landmark} title={t('members.sectionBanking')}>
                    <DetailItem label={t('members.bankAccount')} value={user.bank_account_number} mono />
                    <DetailItem label={t('members.ifsc')} value={user.ifsc_code} mono />
                  </DetailSection>
                </div>

                <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gov-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gov-primary">
                        {t('members.documentsTitle')}
                      </h4>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {memberDocuments.length}
                    </span>
                  </div>
                  {memberDocuments.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">{t('members.noDocuments')}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-4">
                      {memberDocuments.map((item) => (
                        <li key={item.doc_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-500">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {item.original_filename || `Document ${item.doc_id}`}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.stored_date}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Eye className="h-3.5 w-3.5" />}
                              loading={memberDocumentLoading === item.doc_id}
                              onClick={() => handleViewMemberDocument(item)}
                            >
                              {t('members.viewDocument')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Download className="h-3.5 w-3.5" />}
                              onClick={() => handleDownloadMemberDocument(item)}
                            >
                              {t('members.downloadDocument')}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : activeTab === 'shares' ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{t('members.shareTransactionsTitle')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t('members.shareTransactionsDescription')}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <LedgerMetric label={t('members.membershipStarted')} value={formatLedgerDate(membershipStarted)} />
                  <LedgerMetric label={t('members.contributionMonths')} value={t('members.monthsCount', { count: contributionMonths })} />
                  <LedgerMetric label={t('members.totalShareAmount')} value={accumulatedShareAmount === null ? '—' : formatINR(accumulatedShareAmount)} emphasis />
                </div>

                <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gov-primary">{t('members.shareTransactionsTitle')}</h4>
                    <span className="rounded-sm bg-white px-2 py-1 text-xs font-semibold text-slate-600">{shareTransactions.length}</span>
                  </div>
                  {shareTransactions.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-500">{t('members.noShareTransactions')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-white text-[10px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-semibold">{t('members.transactionDate')}</th>
                            <th className="px-4 py-3 font-semibold">{t('members.subscriptionPeriod')}</th>
                            <th className="px-4 py-3 font-semibold">{t('members.feeTier')}</th>
                            <th className="px-4 py-3 text-right font-semibold">{t('members.amount')}</th>
                            <th className="px-4 py-3 font-semibold">{t('members.membershipStarted')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {shareTransactions.map((transaction) => {
                            const assignment = assignmentById.get(transaction.membership_record_id)
                            return (
                              <tr key={transaction.record_id} className="text-slate-700">
                                <td className="whitespace-nowrap px-4 py-3">{formatLedgerDate(transaction.transaction_date)}</td>
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                                  {formatSubscriptionPeriod(transaction.year, transaction.month)}
                                </td>
                                <td className="px-4 py-3">Tier {transaction.mf_id}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gov-primary">
                                  {formatINR(transaction.amount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {formatLedgerDate(assignment?.effective_from)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
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
                              onClick={() => onRecordPayment(loan, fetchHistory, null, (loan.paid_installments || 0) + 1)}
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
                        onClick={() => onRecordPayment(activeLoan, fetchHistory, null, (activeLoan.paid_installments || 0) + 1)}
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
                          ? `${((Number(activeLoan.monthly_interest) / Number(activeLoan.sanction_amount)) * 1200).toFixed(4).replace(/\.?0+$/, '')}% (${formatINR(activeLoan.monthly_interest)})`
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
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-white py-2 text-[11px] font-semibold text-slate-700" aria-label="Payment status color legend">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-200" />Paid</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-red-400 bg-red-200" />Due</span>
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-amber-400 bg-amber-200" />Next upcoming</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 shadow-[0_6px_18px_rgba(15,41,66,0.05)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-xs">
                      <thead>
                        <tr className="border-b-2 border-amber-400 bg-gov-navy text-slate-100 font-bold uppercase">
                          {visibleHistoryColumns.installment && <th className="border-r border-white/10 px-2 py-3 text-center">No.</th>}
                          {visibleHistoryColumns.payment_date && <th className="border-r border-white/10 px-2 py-3">Month</th>}
                          {visibleHistoryColumns.opening_advance && <th className="border-r border-white/10 px-2 py-3 text-right">Advance</th>}
                          {visibleHistoryColumns.recovery && <th className="border-r border-white/10 px-2 py-3 text-right">Recovery</th>}
                          {visibleHistoryColumns.balance && <th className="border-r border-white/10 px-2 py-3 text-right">Balance</th>}
                          {visibleHistoryColumns.interest_year && <th className="border-r border-white/10 px-2 py-3 text-right">Interest / Year</th>}
                          {visibleHistoryColumns.interest_month && <th className="border-r border-white/10 px-2 py-3 text-right">Interest / Month</th>}
                          {visibleHistoryColumns.payable_amount && <th className="border-r border-white/10 px-2 py-3 text-right">Payable Amount</th>}
                          {visibleHistoryColumns.paid_interest && <th className="border-r border-white/10 px-2 py-3 text-right">Paid Interest</th>}
                          {visibleHistoryColumns.paid_amount && <th className="border-r border-white/10 px-2 py-3 text-right">Paid Amount</th>}
                          {visibleHistoryColumns.status && <th className="px-2 py-3 text-center">Payment Status</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {getHistoryRows().map((row) => {
                          const paidRow = row.status === 'Paid'
                          const dueRow = row.status === 'Due'
                          const firstUnpaid = getHistoryRows().find((item) => item.status !== 'Paid')
                          const isNextUnpaid = firstUnpaid?.installment === row.installment
                          const canReceive = isNextUnpaid
                          return (
                          <tr key={row.installment} className={`border-b transition-colors ${paidRow ? 'border-emerald-300 bg-emerald-100' : dueRow ? 'border-red-300 bg-red-100' : isNextUnpaid ? 'border-amber-300 bg-amber-100' : 'border-slate-200 bg-white text-slate-700'}`}>
                            {visibleHistoryColumns.installment && <td className="border-r border-slate-100 px-2 py-2 text-center font-mono font-semibold">{row.installment}</td>}
                            {visibleHistoryColumns.payment_date && <td className="border-r border-slate-100 px-2 py-2 whitespace-nowrap">{row.payment_date}</td>}
                            {visibleHistoryColumns.opening_advance && <td className="border-r border-slate-100 px-2 py-2 text-right font-medium">{formatINR(row.opening_advance.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.recovery && <td className="border-r border-slate-100 px-2 py-2 text-right font-semibold text-green-700">{formatINR(row.recovery.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.balance && <td className="border-r border-slate-100 px-2 py-2 text-right font-semibold">{formatINR(row.balance.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.interest_year && <td className="border-r border-slate-100 px-2 py-2 text-right">{formatINR(row.interest_year.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.interest_month && <td className="border-r border-slate-100 px-2 py-2 text-right">{formatINR(row.interest_month.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.payable_amount && <td className="border-r border-slate-100 px-2 py-2 text-right font-semibold">{formatINR(row.payable_amount.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.paid_interest && <td className="border-r border-slate-100 px-2 py-2 text-right">{formatINR(row.paid_interest.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.paid_amount && <td className="border-r border-slate-100 px-2 py-2 text-right font-semibold">{row.paid_amount === '-' ? '-' : formatINR(row.paid_amount.replace(/,/g, ''))}</td>}
                            {visibleHistoryColumns.status && (
                              <td className="px-2 py-2 text-center">
                                {paidRow ? (
                                  <span className="text-[10px] font-bold text-emerald-800">Received</span>
                                ) : dueRow ? (
                                  <button
                                    type="button"
                                    onClick={() => onRecordPayment?.(activeLoan, fetchHistory, null, row.installment)}
                                    disabled={!onRecordPayment}
                                    className="rounded border border-emerald-600 bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Received
                                  </button>
                                ) : isNextUnpaid ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => onRecordPayment?.(activeLoan, fetchHistory, null, row.installment)}
                                      disabled={!canReceive || !onRecordPayment}
                                      className="rounded border border-emerald-600 bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                      Mark Received
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkDue(row.installment)}
                                      disabled={!canReceive || markingDueInstallment !== null}
                                      className="rounded border border-red-500 bg-red-100 px-1.5 py-1 text-[10px] font-bold text-red-900 hover:bg-red-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                      {markingDueInstallment === row.installment ? 'Saving…' : 'Mark Due'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-500">{row.status}</span>
                                )}
                              </td>
                            )}
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs lg:grid-cols-4">
                  {(() => {
                    const totals = getHistoryTotals()
                    return (
                      <>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Total principal recovered</p>
                          <p className="mt-1 font-bold text-slate-900">{formatINR(totals.recovery)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Total cutoff interest</p>
                          <p className="mt-1 font-bold text-slate-900">{formatINR(totals.interest)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Monthly average interest</p>
                          <p className="mt-1 font-bold text-slate-900">{formatINR(totals.averageInterest)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Recovered with interest</p>
                          <p className="mt-1 font-bold text-slate-900">{formatINR(totals.withInterest)}</p>
                        </div>
                      </>
                    )
                  })()}
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

      <Modal
        isOpen={Boolean(memberDocumentPreview)}
        onClose={() => setMemberDocumentPreview(null)}
        title={memberDocumentPreview?.name || t('members.documentsTitle')}
        maxWidth="max-w-5xl"
      >
        {memberDocumentPreview && (
          <iframe
            title={memberDocumentPreview.name}
            src={memberDocumentPreview.url}
            className="h-[70vh] min-h-80 w-full border-0"
          />
        )}
      </Modal>

      {memberEditOpen && user && (
        <MemberCreate
          initialKgid={user.kgid}
          onClose={() => setMemberEditOpen(false)}
          onSaved={async () => {
            setMemberEditOpen(false)
            await fetchHistory()
          }}
        />
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

function DetailSection({ icon: Icon, title, children }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Icon className="h-4 w-4 text-gov-primary" />
        <h4 className="text-xs font-bold uppercase tracking-wide text-gov-primary">{title}</h4>
      </div>
      <dl className="grid grid-cols-2 gap-x-5 px-4 py-1 sm:grid-cols-3">{children}</dl>
    </section>
  )
}

function LedgerMetric({ label, value, emphasis = false }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-bold ${emphasis ? 'text-gov-primary' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="min-w-0 border-b border-slate-100 py-2.5">
      <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words text-xs font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  )
}
