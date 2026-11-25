import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { PlusCircle, X } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import DataTable from '../../components/common/DataTable.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Modal from '../../components/common/Modal.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import memberService from '../../services/memberService.js'

// Format numbers as Indian Rupees
function formatINR(val) {
  if (val == null || val === '') return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function MembershipFees() {
  const { t }                          = useLanguage()
  const { success, error: toastError } = useToast()

  const [tiers, setTiers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ mode: 'onBlur' })

  const fetchTiers = async () => {
    setLoading(true)
    try {
      const res = await memberService.getFeeTiers()
      setTiers(res.items ?? res.data ?? res ?? [])
    } catch (err) {
      toastError(err.message || t('common.errorFetch'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTiers() }, [])

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      await memberService.createFeeTier({
        share_subscription_fee: parseFloat(data.share_subscription_fee),
        share_fee:              parseFloat(data.share_fee),
        membership_fee:         parseFloat(data.membership_fee),
        description:            data.description || null,
      })
      success(t('fees.createSuccess'))
      setModalOpen(false)
      reset()
      fetchTiers()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'mf_id',                 label: t('fees.tierId'),          render: r => <span className="font-mono text-sm">{r.mf_id}</span> },
    { key: 'description',           label: t('fees.description'),      render: r => r.description || '—' },
    { key: 'share_subscription_fee',label: t('fees.subscriptionFee'),  render: r => formatINR(r.share_subscription_fee) },
    { key: 'share_fee',             label: t('fees.shareFee'),         render: r => formatINR(r.share_fee) },
    { key: 'membership_fee',        label: t('fees.membershipFee'),    render: r => <span className="font-semibold text-gov-primary">{formatINR(r.membership_fee)}</span> },
    {
      key: 'is_active',
      label: t('common.status'),
      render: r => (
        <span className={r.is_active !== false ? 'badge-active' : 'badge-inactive'}>
          {r.is_active !== false ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={t('fees.title')}
        subtitle={t('fees.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setModalOpen(true)}
          >
            {t('fees.addTier')}
          </Button>
        }
      />

      {/* Info notice */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
        {t('fees.notice')}
      </div>

      <DataTable
        columns={columns}
        data={tiers}
        loading={loading}
        emptyMessage={t('fees.noRecordsFound')}
      />

      {/* Add Fee Tier Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); reset() }}
        title={t('fees.addTierTitle')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('fees.description')}
            placeholder={t('fees.descriptionPlaceholder')}
            error={errors.description?.message}
            {...register('description')}
          />

          <Input
            label={t('fees.subscriptionFee') + ' (₹) *'}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            error={errors.share_subscription_fee?.message}
            {...register('share_subscription_fee', {
              required: t('validation.required'),
              min: { value: 0, message: t('validation.minValue', { n: 0 }) },
            })}
          />

          <Input
            label={t('fees.shareFee') + ' (₹) *'}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            error={errors.share_fee?.message}
            {...register('share_fee', {
              required: t('validation.required'),
              min: { value: 0, message: t('validation.minValue', { n: 0 }) },
            })}
          />

          <Input
            label={t('fees.membershipFee') + ' (₹) *'}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            error={errors.membership_fee?.message}
            {...register('membership_fee', {
              required: t('validation.required'),
              min: { value: 0, message: t('validation.minValue', { n: 0 }) },
            })}
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); reset() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving} icon={<PlusCircle className="w-4 h-4" />}>
              {t('fees.saveTier')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
