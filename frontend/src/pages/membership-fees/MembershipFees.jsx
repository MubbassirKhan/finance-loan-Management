import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CheckCircle2, CirclePause, Pencil, PlusCircle } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import DataTable from '../../components/common/DataTable.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Modal from '../../components/common/Modal.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
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
  const [editingTier, setEditingTier] = useState(null)
  const [tierPendingStatus, setTierPendingStatus] = useState(null)
  const [statusSaving, setStatusSaving] = useState(false)

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
      const feeData = {
        share_subscription_fee: parseFloat(data.share_subscription_fee),
        share_fee:              parseFloat(data.share_fee),
        membership_fee:         parseFloat(data.membership_fee),
        description:            data.description || null,
      }
      if (editingTier) {
        await memberService.updateFeeTier(editingTier.mf_id, feeData)
        success(t('fees.updateSuccess', 'Fee tier updated successfully.'))
      } else {
        await memberService.createFeeTier(feeData)
        success(t('fees.createSuccess'))
      }
      setModalOpen(false)
      setEditingTier(null)
      reset()
      fetchTiers()
    } catch (err) {
      toastError(err.message || t('common.errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const openCreateModal = () => {
    setEditingTier(null)
    reset({ description: '', share_subscription_fee: '', share_fee: '', membership_fee: '' })
    setModalOpen(true)
  }

  const openEditModal = (tier) => {
    setEditingTier(tier)
    reset({
      description: tier.description || '',
      share_subscription_fee: tier.share_subscription_fee,
      share_fee: tier.share_fee,
      membership_fee: tier.membership_fee,
    })
    setModalOpen(true)
  }

  const confirmTierStatusChange = async () => {
    if (!tierPendingStatus) return
    const nextIsActive = tierPendingStatus.is_active === false
    setStatusSaving(true)
    try {
      await memberService.updateFeeTierStatus(tierPendingStatus.mf_id, nextIsActive)
      success(nextIsActive
        ? t('fees.activatedSuccess', 'Fee tier activated successfully.')
        : t('fees.deactivatedSuccess', 'Fee tier marked inactive.'))
      setTierPendingStatus(null)
      await fetchTiers()
    } catch (err) {
      toastError(err.message || t('common.errorSave', 'Could not update fee tier status.'))
    } finally {
      setStatusSaving(false)
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
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'center',
      className: 'w-28 min-w-28 whitespace-nowrap',
      render: r => (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => openEditModal(r)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-blue-200 bg-white text-gov-primary shadow-sm transition hover:-translate-y-0.5 hover:border-gov-primary hover:bg-blue-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary"
            title="Edit fee tier"
            aria-label={`Edit fee tier ${r.mf_id}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTierPendingStatus(r)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 ${r.is_active !== false
              ? 'border-amber-200 text-amber-700 hover:border-amber-400 hover:bg-amber-50 focus-visible:ring-amber-500'
              : 'border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-emerald-600'}`}
            title={r.is_active !== false ? 'Mark fee tier inactive' : 'Activate fee tier'}
            aria-label={`${r.is_active !== false ? 'Mark inactive' : 'Activate'} fee tier ${r.mf_id}`}
          >
            {r.is_active !== false ? <CirclePause className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page-stack">
      <PageHeader
        title={t('fees.title')}
        subtitle={t('fees.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={openCreateModal}
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
        onClose={() => { setModalOpen(false); setEditingTier(null); reset() }}
        title={editingTier ? t('fees.editTierTitle', 'Edit Fee Tier') : t('fees.addTierTitle')}
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
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); setEditingTier(null); reset() }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving} icon={editingTier ? <Pencil className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}>
              {editingTier ? t('fees.updateTier', 'Update Fee Tier') : t('fees.saveTier')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(tierPendingStatus)}
        onClose={() => setTierPendingStatus(null)}
        onConfirm={confirmTierStatusChange}
        loading={statusSaving}
        title={tierPendingStatus?.is_active !== false ? 'Mark fee tier inactive?' : 'Activate fee tier?'}
        message={tierPendingStatus?.is_active !== false
          ? `Fee tier ${tierPendingStatus?.mf_id ?? ''} will be marked inactive. Its record will be kept and can be activated again.`
          : `Fee tier ${tierPendingStatus?.mf_id ?? ''} will be available for new member registrations again.`}
        confirmLabel={tierPendingStatus?.is_active !== false ? 'Mark Inactive' : 'Activate'}
        confirmVariant={tierPendingStatus?.is_active !== false ? 'danger' : 'success'}
      />
    </div>
  )
}
