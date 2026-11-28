import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { FileText, Save, Upload, X } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Select from '../../components/common/Select.jsx'
import Modal from '../../components/common/Modal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import memberService from '../../services/memberService.js'
import policeStationService from '../../services/policeStationService.js'

const GENDERS    = [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]
const CATEGORIES = [
  { value: 'GM',  label: 'GM – General Merit' },
  { value: '2A',  label: '2A' },
  { value: '2B',  label: '2B' },
  { value: '3A',  label: '3A' },
  { value: '3B',  label: '3B' },
  { value: 'SC',  label: 'SC – Scheduled Caste' },
  { value: 'ST',  label: 'ST – Scheduled Tribe' },
]

// IFSC regex: 4 uppercase letters + 0 + 6 alphanumeric
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

function getLocalDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function MemberCreate({ onClose: onCloseModal = null, onSaved = null, initialKgid = null }) {
  const { t } = useLanguage()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()
  const { kgid: routeKgid } = useParams()
  const memberKgid = initialKgid || (routeKgid ? decodeURIComponent(routeKgid) : null)

  const [stations, setStations]   = useState([])
  const [feeTiers, setFeeTiers]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState([])

  const {
    register, handleSubmit, formState: { errors }, setError, reset,
  } = useForm({
    mode: 'onBlur',
    defaultValues: { membership_start_date: getLocalDateString() },
  })

  // Load form options and the member profile when editing.
  useEffect(() => {
    let cancelled = false
    const loadFormData = async () => {
      setLoadingData(true)
      try {
        const [stRes, ftRes, member] = await Promise.all([
          policeStationService.getStations({ page: 1, size: 100, active_only: true }),
          memberService.getFeeTiers(),
          memberKgid ? memberService.getMemberByKgid(memberKgid) : Promise.resolve(null),
        ])
        if (cancelled) return
        setStations((stRes.items ?? stRes.data ?? []).map(s => ({ value: s.ps_id, label: s.station_name })))
        const tiers = ftRes.items ?? ftRes.data ?? ftRes ?? []
        const selectableTiers = tiers.filter(f => (
          f.is_active !== false || (member && Number(member.mf_id) === f.mf_id)
        ))
        setFeeTiers(selectableTiers.map(f => ({
          value: f.mf_id,
          label: `Tier ${f.mf_id} — ₹${Number(f.membership_fee).toLocaleString('en-IN')}`,
        })))
        if (member) {
          reset({
            ...member,
            ps_id: String(member.ps_id),
            mf_id: String(member.mf_id),
          })
        }
      } catch (err) {
        if (!cancelled) toastError(err.message || t('common.errorFetch'))
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    loadFormData()
    return () => { cancelled = true }
  }, [memberKgid, reset])

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const { kgid, ...memberFields } = data
      const payload = {
        ...memberFields,
        mf_id: parseInt(data.mf_id, 10),
      }
      const savedMember = memberKgid
        ? await memberService.updateMember(memberKgid, payload)
        : await memberService.createMember({ ...payload, kgid })

      if (selectedFiles.length) {
        try {
          await memberService.uploadMemberDocuments(savedMember.kgid, selectedFiles)
        } catch (uploadError) {
          toastError(t('members.documentUploadFailed', { message: uploadError.message }))
          if (onSaved) onSaved(savedMember)
          else navigate(`/members/${encodeURIComponent(savedMember.kgid)}`)
          return
        }
      }

      success(memberKgid ? 'Member details updated.' : t('members.createSuccess'))
      if (onSaved) onSaved(savedMember)
      else navigate(`/members/${encodeURIComponent(savedMember.kgid)}`)
    } catch (err) {
      if (err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([field, msg]) => {
          setError(field, { type: 'server', message: msg })
        })
      } else {
        toastError(err.message || t('common.errorSave'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    const loadingContent = (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
    return (
      <Modal
        isOpen
        onClose={onCloseModal}
        title={memberKgid ? t('members.editTitle') : t('members.createTitle')}
        maxWidth="max-w-5xl"
      >
        {loadingContent}
      </Modal>
    )
  }

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Personal Information ──────────────────────────── */}
        <div className="section-card p-6">
          <h3 className="form-section-header">{t('members.sectionPersonal')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Input
              label={t('members.kgid') + ' *'}
              placeholder="e.g. KGD123456"
              error={errors.kgid?.message}
              readOnly={Boolean(memberKgid)}
              {...register('kgid', {
                required: t('validation.required'),
                minLength: { value: 3, message: t('validation.minLength', { n: 3 }) },
              })}
            />

            <Input
              label={t('members.fullName') + ' *'}
              placeholder={t('members.fullNamePlaceholder')}
              error={errors.full_name?.message}
              {...register('full_name', { required: t('validation.required') })}
            />

            <Input
              label={t('members.dob')}
              type="date"
              error={errors.dob?.message}
              {...register('dob', { required: t('validation.required') })}
            />

            <Select
              label={t('members.gender')}
              options={GENDERS}
              error={errors.gender?.message}
              {...register('gender', { required: t('validation.required') })}
            />

            <Input
              label={t('members.caste')}
              placeholder={t('members.castePlaceholder')}
              error={errors.caste?.message}
              {...register('caste')}
            />

            <Input
              label={t('members.subCaste')}
              placeholder={t('members.subCastePlaceholder')}
              error={errors.sub_caste?.message}
              {...register('sub_caste')}
            />

            <Select
              label={t('members.category')}
              options={CATEGORIES}
              error={errors.category?.message}
              {...register('category')}
            />
          </div>
        </div>

        {/* ── Employment & Station ─────────────────────────── */}
        <div className="section-card p-6">
          <h3 className="form-section-header">{t('members.sectionEmployment')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Input
              label={t('members.shareNo')}
              placeholder="e.g. SH-0001"
              error={errors.share_number?.message}
              {...register('share_number')}
            />

            <Input
              label={t('members.buckleNo')}
              placeholder="e.g. BK-0001"
              error={errors.buckle_number?.message}
              {...register('buckle_number')}
            />

            <Input
              label={t('members.designation') + ' *'}
              placeholder={t('members.designationPlaceholder')}
              error={errors.designation?.message}
              {...register('designation', { required: t('validation.required') })}
            />

            <Select
              label={t('members.station') + ' *'}
              options={stations}
              placeholder={t('members.selectStation')}
              error={errors.ps_id?.message}
              {...register('ps_id', { required: t('validation.required') })}
            />
          </div>
        </div>

        {/* ── Membership Period ────────────────────────────── */}
        <div className="section-card p-6">
          <h3 className="form-section-header">{t('members.sectionMembership')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Select
              label={t('members.feeTier') + ' *'}
              options={feeTiers}
              placeholder={t('members.selectFeeTier')}
              error={errors.mf_id?.message}
              {...register('mf_id', { required: t('validation.required') })}
            />

            <Input
              label={t('members.membershipStartDate') + ' *'}
              type="date"
              max={getLocalDateString()}
              error={errors.membership_start_date?.message}
              {...register('membership_start_date', { required: t('validation.required') })}
            />
          </div>
        </div>

        {/* ── Member Documents ────────────────────────────── */}
        <div className="section-card p-6">
          <h3 className="form-section-header">{t('members.documentsTitle')}</h3>
          <div className="space-y-3">
            <label
              htmlFor="member-documents"
              className="relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-gov-primary"
            >
              <Upload className="h-4 w-4" />
              {t('members.chooseDocuments')}
              <input
                id="member-documents"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => {
                  setSelectedFiles(Array.from(event.currentTarget.files || []))
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <p className="text-xs text-slate-500">{t('members.documentFormats')}</p>
            {selectedFiles.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded border border-slate-200">
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate text-slate-700">
                      <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      title="Remove file"
                      onClick={() => setSelectedFiles(files => files.filter((_, fileIndex) => fileIndex !== index))}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Banking Information ──────────────────────────── */}
        <div className="section-card p-6">
          <h3 className="form-section-header">{t('members.sectionBanking')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Input
              label={t('members.bankAccount') + ' *'}
              placeholder={t('members.bankAccountPlaceholder')}
              error={errors.bank_account_number?.message}
              {...register('bank_account_number', {
                required: t('validation.required'),
                minLength: { value: 9, message: t('validation.minLength', { n: 9 }) },
                maxLength: { value: 18, message: t('validation.maxLength', { n: 18 }) },
                pattern: { value: /^\d+$/, message: t('validation.digitsOnly') },
              })}
            />

            <Input
              label={t('members.ifsc') + ' *'}
              placeholder="e.g. SBIN0001234"
              maxLength={11}
              error={errors.ifsc_code?.message}
              {...register('ifsc_code', {
                required: t('validation.required'),
                pattern: { value: IFSC_REGEX, message: t('validation.ifscInvalid') },
                setValueAs: v => v.toUpperCase(),
              })}
              className="uppercase"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCloseModal}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<Save className="w-4 h-4" />}
          >
            {memberKgid ? 'Save Changes' : t('members.saveMember')}
          </Button>
        </div>
      </form>
  )

  return (
    <Modal
      isOpen
      onClose={onCloseModal}
      title={memberKgid ? t('members.editTitle') : t('members.createTitle')}
      subtitle={memberKgid ? `KGID: ${memberKgid}` : t('members.createSubtitle')}
      maxWidth="max-w-5xl"
    >
      {formContent}
    </Modal>
  )
}
