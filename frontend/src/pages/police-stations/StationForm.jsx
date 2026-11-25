import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Button from '../../components/common/Button.jsx'
import Input from '../../components/common/Input.jsx'
import Loading from '../../components/common/Loading.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import policeStationService from '../../services/policeStationService.js'

export default function StationForm() {
  const { ps_id }                      = useParams()   // undefined when creating
  const isEdit                         = Boolean(ps_id)
  const { t }                          = useLanguage()
  const { success, error: toastError } = useToast()
  const navigate                       = useNavigate()

  const [loading, setLoading]      = useState(false)
  const [loadingData, setLoadingData] = useState(isEdit)

  const {
    register, handleSubmit, reset, formState: { errors }, setError,
  } = useForm({ mode: 'onBlur' })

  // If editing, pre-load existing data
  useEffect(() => {
    if (!isEdit) return
    policeStationService
      .getStationById(ps_id)
      .then(data => {
        reset({
          station_name: data.station_name,
          address:      data.address || '',
          is_active:    data.is_active,
        })
      })
      .catch(err => {
        toastError(err.message || t('common.errorFetch'))
        navigate('/police-stations')
      })
      .finally(() => setLoadingData(false))
  }, [ps_id])

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      if (isEdit) {
        await policeStationService.updateStation(ps_id, {
          station_name: data.station_name,
          address:      data.address || null,
          is_active:    data.is_active === true || data.is_active === 'true',
        })
        success(t('stations.updateSuccess'))
      } else {
        await policeStationService.createStation({
          station_name: data.station_name,
          address:      data.address || null,
        })
        success(t('stations.createSuccess'))
      }
      navigate('/police-stations')
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

  if (loadingData) return <Loading fullScreen />

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={isEdit ? t('stations.editTitle') : t('stations.createTitle')}
        subtitle={isEdit ? t('stations.editSubtitle') : t('stations.createSubtitle')}
        actions={
          <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/police-stations')}>
            {t('common.back')}
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="section-card p-6 space-y-5">

          <Input
            label={t('stations.name') + ' *'}
            placeholder={t('stations.namePlaceholder')}
            error={errors.station_name?.message}
            {...register('station_name', { required: t('validation.required') })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('stations.address')}
            </label>
            <textarea
              rows={3}
              placeholder={t('stations.addressPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gov-primary resize-none"
              {...register('address')}
            />
          </div>

          {/* is_active toggle — only shown in edit mode */}
          {isEdit && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                className="w-4 h-4 accent-gov-primary"
                {...register('is_active')}
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                {t('stations.isActive')}
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-5">
          <Button type="button" variant="outline" onClick={() => navigate('/police-stations')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={loading} icon={<Save className="w-4 h-4" />}>
            {isEdit ? t('common.saveChanges') : t('stations.createStation')}
          </Button>
        </div>
      </form>
    </div>
  )
}
