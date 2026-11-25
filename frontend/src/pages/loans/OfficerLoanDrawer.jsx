import React, { useEffect, useState, useCallback } from 'react'
import {
  X, Printer, Download, User, HandCoins, FileSpreadsheet,
  PlusCircle, Shield, CheckCircle2, Clock, Paperclip
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
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const user = history?.user
  const loans = history?.loans || []
  const allPayments = history?.payments || []

  const activeLoan = loans.find((l) => l.loan_id === selectedLoanId) || loans[0] || null
  const loanPayments = activeLoan
    ? allPayments.filter((p) => p.loan_id === activeLoan.loan_id)
    : allPayments

  // Export officer's transactional history to CSV
  const handleDownloadHistoryCSV = () => {
    if (!user) return
    const headers = [
      'Installment #',
      'Loan ID',
      'Loan Type',
      'Payment Date',
      'Opening Advance (INR)',
      'Recovered Amount (INR)',
      'Remaining Balance (INR)',
      'Interest Paid (INR)',
      'Status',
    ]

    let runningAdvance = activeLoan ? Number(activeLoan.sanction_amount) : 0
    const rows = loanPayments.map((p, idx) => {
      const adv = runningAdvance
      runningAdvance = Number(p.balance)
      return [
        idx + 1,
        p.loan_id,
        activeLoan?.loan_type || '',
        p.payment_date,
        adv.toFixed(2),
        Number(p.recovered_amount).toFixed(2),
        Number(p.balance).toFixed(2),
        Number(p.total_interest).toFixed(2),
        p.status,
      ]
    })

    const csvContent =
      '\uFEFF' +
      [
        [`Officer: ${user.full_name}`, `KGID: ${user.kgid}`, `Rank: ${user.designation}`, `Station: ${user.station_name}`],
        [],
        headers,
        ...rows,
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

  // Print / Save PDF
  const handlePrint = () => {
    window.print()
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
                            <a
                              href={loanService.getAttachmentDownloadUrl(loan.loan_id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              {t('loans.downloadAttachment')}
                            </a>
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

                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={handleDownloadHistoryCSV}
                    >
                      {t('loans.exportCsv')}
                    </Button>

                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Printer className="w-3.5 h-3.5" />}
                      onClick={handlePrint}
                    >
                      {t('loans.printSavePdf')}
                    </Button>

                    {activeLoan?.document_attachment && (
                      <a
                        href={loanService.getAttachmentDownloadUrl(activeLoan.loan_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {t('loans.downloadAttachment')}
                      </a>
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
                <div className="border border-slate-200 rounded overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                          <th className="px-3 py-2.5">{t('loans.installmentNo')}</th>
                          <th className="px-3 py-2.5">{t('loans.paymentDate')}</th>
                          <th className="px-3 py-2.5 text-right">{t('loans.openingAdvance')}</th>
                          <th className="px-3 py-2.5 text-right">{t('loans.recovery')}</th>
                          <th className="px-3 py-2.5 text-right">{t('loans.balance')}</th>
                          <th className="px-3 py-2.5 text-right">{t('loans.interest')}</th>
                          <th className="px-3 py-2.5 text-center">{t('common.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
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
                                <tr key={pay.pay_id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">
                                    {idx + 1}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700">{pay.payment_date}</td>
                                  <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                                    {formatINR(currentAdvance)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                                    {formatINR(pay.recovered_amount)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                                    {formatINR(pay.balance)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-slate-700">
                                    {formatINR(pay.total_interest)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold bg-green-100 text-green-800">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {pay.status}
                                    </span>
                                  </td>
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
