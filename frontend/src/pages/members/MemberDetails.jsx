import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Briefcase, Download, Eye, FileText, Landmark, Pencil, User, UserCheck, UserX, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Button from '../../components/common/Button.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import Loading from '../../components/common/Loading.jsx'
import Modal from '../../components/common/Modal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import memberService from '../../services/memberService.js'

// Row display helper
function InfoRow({ label, value }) {
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="section-card overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gov-primary" />
        <h3 className="text-sm font-semibold text-gov-primary uppercase tracking-wide">{title}</h3>
      </div>
      <dl className="px-5 py-1">{children}</dl>
    </div>
  )
}

export default function MemberDetails({ memberKgid: propKgid = null, isModal = false, onClose = null, onEdit = null, onUpdated = null }) {
  const { kgid: routeKgid } = useParams()
  const memberKgid = propKgid || (routeKgid ? decodeURIComponent(routeKgid) : null)
  const { t }    = useLanguage()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()

  const [member, setMember]   = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [confirmStatusChange, setConfirmStatusChange] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(null)

  useEffect(() => {
    let cancelled = false
    memberService
      .getMemberByKgid(memberKgid)
      .then(data => {
        if (!cancelled) setMember(data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message || t('common.errorFetch'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    memberService.getMemberDocuments(memberKgid)
      .then(data => { if (!cancelled) setDocuments(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [memberKgid])

  useEffect(() => {
    if (!previewDocument?.url) return undefined
    return () => URL.revokeObjectURL(previewDocument.url)
  }, [previewDocument])

  const handleStatusChange = async () => {
    const nextStatus = member.status === 'Active' ? 'Inactive' : 'Active'
    setStatusLoading(true)
    try {
      const updated = await memberService.updateMemberStatus(member.kgid, nextStatus)
      setMember(updated)
      onUpdated?.(updated)
      success(`Member marked ${nextStatus.toLowerCase()}.`)
      setConfirmStatusChange(false)
    } catch (err) {
      toastError(err.message || 'Could not update member status.')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleDownload = async (item) => {
    try {
      const blob = await memberService.downloadMemberDocument(member.kgid, item.doc_id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.original_filename || `member-document-${item.doc_id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toastError(err.message || t('members.downloadDocumentError'))
    }
  }

  const handleViewDocument = async (item) => {
    setPreviewLoading(item.doc_id)
    try {
      const blob = await memberService.downloadMemberDocument(member.kgid, item.doc_id)
      setPreviewDocument({
        name: item.original_filename || `Document ${item.doc_id}`,
        url: URL.createObjectURL(blob),
      })
    } catch (err) {
      toastError(err.message || t('members.viewDocumentError'))
    } finally {
      setPreviewLoading(null)
    }
  }

  const memberContent = (
    <div className="space-y-5">
      <div>
        <span className={member?.status === 'Active' ? 'badge-active' : 'badge-inactive'}>
          {member?.status}
        </span>
      </div>

      <SectionCard icon={User} title={t('members.sectionPersonal')}>
        <InfoRow label={t('members.kgid')} value={member?.kgid} />
        <InfoRow label={t('members.fullName')} value={member?.full_name} />
        <InfoRow label={t('members.dob')} value={member?.dob} />
        <InfoRow label={t('members.gender')} value={member?.gender} />
        <InfoRow label={t('members.caste')} value={member?.caste} />
        <InfoRow label={t('members.subCaste')} value={member?.sub_caste} />
        <InfoRow label={t('members.category')} value={member?.category} />
      </SectionCard>

      <SectionCard icon={Briefcase} title={t('members.sectionEmployment')}>
        <InfoRow label={t('members.designation')} value={member?.designation} />
        <InfoRow label={t('members.station')} value={member?.station_name || member?.ps_id} />
        <InfoRow label={t('members.shareNo')} value={member?.share_number} />
        <InfoRow label={t('members.buckleNo')} value={member?.buckle_number} />
      </SectionCard>

      <SectionCard icon={FileText} title={t('members.sectionMembership')}>
        <InfoRow label={t('members.feeTier')} value={member?.mf_id} />
        <InfoRow label={t('members.financialYear')} value={member?.financial_year} />
        <InfoRow label={t('members.financialMonth')} value={member?.financial_month} />
        <InfoRow label="Created At" value={member?.created_at ? new Date(member.created_at).toLocaleDateString('en-IN') : '—'} />
      </SectionCard>

      <SectionCard icon={Landmark} title={t('members.sectionBanking')}>
        <InfoRow label={t('members.bankAccount')} value={member?.bank_account_number} />
        <InfoRow label={t('members.ifsc')} value={member?.ifsc_code} />
      </SectionCard>

      <SectionCard icon={FileText} title={t('members.documentsTitle')}>
        {documents.length ? documents.map(item => (
          <div key={item.doc_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{item.original_filename || `Document ${item.doc_id}`}</p>
              <p className="text-xs text-gray-500">{item.stored_date}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<Eye className="h-3.5 w-3.5" />}
                loading={previewLoading === item.doc_id}
                onClick={() => handleViewDocument(item)}
              >
                {t('members.viewDocument')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => handleDownload(item)}
              >
                {t('members.downloadDocument')}
              </Button>
            </div>
          </div>
        )) : (
          <p className="px-5 py-4 text-sm text-gray-500">{t('members.noDocuments')}</p>
        )}
      </SectionCard>

      {previewDocument && (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-800">{previewDocument.name}</p>
            <button
              type="button"
              onClick={() => setPreviewDocument(null)}
              aria-label={t('members.closeDocumentPreview')}
              className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              {t('members.closeDocumentPreview')}
            </button>
          </div>
          <iframe
            title={previewDocument.name}
            src={previewDocument.url}
            className="h-[55vh] min-h-72 w-full border-0"
          />
        </section>
      )}
    </div>
  )

  if (loading) {
    return isModal
      ? <Modal isOpen onClose={onClose} title={t('members.memberDetails')}><Loading /></Modal>
      : <Loading fullScreen />
  }

  if (error) {
    const errorContent = (
      <div className="p-6">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
        <Button variant="outline" className="mt-4" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => (onClose ? onClose() : navigate('/members'))}>
          {t('common.back')}
        </Button>
      </div>
    )
    return isModal
      ? <Modal isOpen onClose={onClose} title={t('members.memberDetails')}>{errorContent}</Modal>
      : errorContent
  }

  if (isModal) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={member?.full_name || t('members.memberDetails')}
        subtitle={`KGID: ${member?.kgid}`}
        maxWidth="max-w-5xl"
      >
        <div className="mb-4 flex justify-end">
          <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit?.(member)}>
            Edit Member
          </Button>
        </div>
        {memberContent}
      </Modal>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={member?.full_name || t('members.memberDetails')}
        subtitle={`KGID: ${member?.kgid}`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={() => navigate(`/members/${encodeURIComponent(member.kgid)}/edit`)}>
              Edit Member
            </Button>
            <Button
              variant={member.status === 'Active' ? 'danger' : 'success'}
              icon={member.status === 'Active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              onClick={() => setConfirmStatusChange(true)}
            >
              {member.status === 'Active' ? 'Make Inactive' : 'Make Active'}
            </Button>
            <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/members')}>
              {t('common.back')}
            </Button>
          </div>
        }
      />

      {memberContent}

      <ConfirmDialog
        isOpen={confirmStatusChange}
        onClose={() => setConfirmStatusChange(false)}
        onConfirm={handleStatusChange}
        loading={statusLoading}
        title={member.status === 'Active' ? 'Make Member Inactive?' : 'Make Member Active?'}
        message={member.status === 'Active'
          ? 'This member record will be kept and marked inactive. No data will be deleted.'
          : 'This member record will be marked active again.'}
        confirmLabel={member.status === 'Active' ? 'Make Inactive' : 'Make Active'}
        confirmVariant={member.status === 'Active' ? 'danger' : 'success'}
      />
    </div>
  )
}
