import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/common/Button.jsx'
import Input from '../components/common/Input.jsx'
import Modal from '../components/common/Modal.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import adminManagementService from '../services/adminManagementService.js'

function InfoRow({ label, value }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-gray-900">{value}</dd>
    </div>
  )
}

export default function Settings() {
  const { t, language } = useLanguage()
  const { admin, logout } = useAuth()
  const { success, error: toastError } = useToast()
  const navigate  = useNavigate()
  const [admins, setAdmins] = useState([])
  const [sessionLogs, setSessionLogs] = useState([])
  const [managementLoading, setManagementLoading] = useState(true)
  const [createAdminOpen, setCreateAdminOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [clearDataOpen, setClearDataOpen] = useState(false)
  const [clearPassword, setClearPassword] = useState('')
  const [clearConfirmation, setClearConfirmation] = useState('')
  const [clearingData, setClearingData] = useState(false)
  const dateLocale = language === 'kn' ? 'kn-IN' : 'en-IN'

  const loadAdminData = async () => {
    setManagementLoading(true)
    try {
      const [adminAccounts, logs] = await Promise.all([
        adminManagementService.getAdmins(),
        adminManagementService.getSessionLogs(),
      ])
      setAdmins(adminAccounts)
      setSessionLogs(logs)
    } catch (err) {
      toastError(err.message || t('settings.loadAdminDataError'))
    } finally {
      setManagementLoading(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  const handleCreateAdmin = async (event) => {
    event.preventDefault()
    setSavingAdmin(true)
    try {
      await adminManagementService.createAdmin({ username: newUsername, password: newPassword })
      setNewUsername('')
      setNewPassword('')
      setCreateAdminOpen(false)
      success(t('settings.adminCreated'))
      await loadAdminData()
    } catch (err) {
      toastError(err.message || t('settings.createAdminError'))
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleClearData = async (event) => {
    event.preventDefault()
    if (clearConfirmation !== 'DELETE ALL DATA') return

    setClearingData(true)
    try {
      await adminManagementService.clearApplicationData({
        current_password: clearPassword,
        confirmation: clearConfirmation,
      })
      setClearDataOpen(false)
      success(t('settings.clearDataSuccess'))
      window.setTimeout(() => window.location.assign('/login'), 700)
    } catch (err) {
      toastError(err.message || t('settings.clearDataError'))
    } finally {
      setClearingData(false)
    }
  }

  const formatDateTime = (value) => value
    ? new Date(value).toLocaleString(dateLocale)
    : '—'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Account Information */}
      <div className="section-card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-gov-primary" />
          <h3 className="text-sm font-semibold text-gov-primary uppercase tracking-wide">
            {t('settings.accountInfo')}
          </h3>
        </div>
        <dl className="px-5 py-1">
          <InfoRow label={t('settings.username')}      value={admin?.username || '—'} />
          <InfoRow label={t('settings.role')}          value="Administrator" />
          <InfoRow label={t('settings.systemVersion')} value="1.0.0" />
          <InfoRow label={t('settings.database')}      value="financeDB (PostgreSQL 18)" />
        </dl>
      </div>

      <section className="section-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gov-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gov-primary">{t('settings.adminAccounts')}</h3>
          </div>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateAdminOpen(true)}>
            {t('settings.addAdmin')}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">{t('settings.username')}</th>
                <th className="px-5 py-3">{t('settings.created')}</th>
                <th className="px-5 py-3">{t('settings.accountStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {managementLoading ? (
                <tr><td colSpan="3" className="px-5 py-5 text-slate-500">{t('settings.loadingAdminData')}</td></tr>
              ) : admins.map((account) => (
                <tr key={account.admin_id}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{account.username}{account.admin_id === admin?.admin_id ? ` (${t('settings.you')})` : ''}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(account.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${account.must_change_password ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
                      {account.must_change_password ? t('settings.mustChangePassword') : t('settings.accountReady')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gov-primary">{t('settings.sessionLogs')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('settings.sessionLogsNote')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('settings.username')}</th>
                <th className="px-4 py-3">{t('settings.signIn')}</th>
                <th className="px-4 py-3">{t('settings.lastActivity')}</th>
                <th className="px-4 py-3">{t('settings.ipAddress')}</th>
                <th className="px-4 py-3">{t('settings.device')}</th>
                <th className="px-4 py-3">{t('settings.sessionStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {managementLoading ? (
                <tr><td colSpan="6" className="px-4 py-5 text-slate-500">{t('settings.loadingSessionLogs')}</td></tr>
              ) : sessionLogs.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-5 text-slate-500">{t('settings.noSessionLogs')}</td></tr>
              ) : sessionLogs.map((log) => {
                const expired = new Date(log.expires_at).getTime() <= Date.now()
                const active = !log.is_revoked && !expired
                return (
                  <tr key={log.session_id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.username}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(log.last_activity_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.ip_address || '—'}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-xs text-slate-600" title={log.user_agent || ''}>{log.user_agent || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>
                        {log.is_revoked ? t('settings.revoked') : expired ? t('settings.expired') : t('settings.active')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-red-300 bg-white">
        <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          <div>
            <h3 className="text-sm font-bold text-red-900">{t('settings.dangerZone')}</h3>
            <p className="mt-1 text-sm text-red-800">{t('settings.clearDataDescription')}</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setClearDataOpen(true)}>
            {t('settings.clearData')}
          </Button>
        </div>
      </section>

      {/* Security */}
      <div className="section-card overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gov-primary" />
          <h3 className="text-sm font-semibold text-gov-primary uppercase tracking-wide">
            {t('settings.security')}
          </h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">{t('settings.securityNote')}</p>
          <Button
            variant="outline"
            icon={<KeyRound className="w-4 h-4" />}
            onClick={() => navigate('/change-password')}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </div>

      {/* System Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{t('settings.notice')}</span>
      </div>

      <Modal
        isOpen={createAdminOpen}
        onClose={() => setCreateAdminOpen(false)}
        title={t('settings.addAdmin')}
        subtitle={t('settings.createAdminNote')}
        maxWidth="max-w-lg"
      >
        <form className="space-y-4" onSubmit={handleCreateAdmin}>
          <Input
            label={t('settings.username')}
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            minLength={3}
            maxLength={50}
            autoComplete="off"
            required
          />
          <Input
            label={t('settings.temporaryPassword')}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            helperText={t('settings.passwordRules')}
            required
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setCreateAdminOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={savingAdmin}>{t('settings.createAdmin')}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={clearDataOpen}
        onClose={() => setClearDataOpen(false)}
        title={t('settings.clearDataConfirmTitle')}
        subtitle={t('settings.clearDataDescription')}
        maxWidth="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleClearData}>
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-bold">{t('settings.clearDataWarning')}</p>
            <p className="mt-1">{t('settings.preservedAdminsNotice')}</p>
          </div>
          <Input
            label={t('settings.currentPassword')}
            type="password"
            value={clearPassword}
            onChange={(event) => setClearPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Input
            label={t('settings.typeConfirmation')}
            value={clearConfirmation}
            onChange={(event) => setClearConfirmation(event.target.value)}
            autoComplete="off"
            required
          />
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setClearDataOpen(false)}>{t('common.cancel')}</Button>
            <Button
              type="submit"
              variant="danger"
              loading={clearingData}
              disabled={clearConfirmation !== 'DELETE ALL DATA' || !clearPassword}
            >
              {t('settings.confirmClearData')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
