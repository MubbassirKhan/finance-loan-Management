import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export const ChangePassword = () => {
  const { changePassword, logout } = useAuth();
  const { t } = useLanguage();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password requirement validations
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isMatch = newPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!hasMinLength || !hasLetter || !hasNumber || !hasSpecial) {
      setErrorMessage(t('auth.passwordRequirement', 'Password must meet all complexity requirements.'));
      return;
    }

    if (!isMatch) {
      setErrorMessage(t('auth.passwordMismatch', 'New passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      success('Password updated successfully. Full access granted.');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.message || 'Failed to change password.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded border border-slate-300 shadow-md overflow-hidden">
        {/* Header Alert Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-5 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-amber-900 leading-snug">
              {t('auth.changePasswordRequired', 'Initial Password Change Required')}
            </h2>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              {t(
                'auth.changePasswordSubtitle',
                'For security compliance, you must change the default administrator password before accessing the system.'
              )}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Input
            label={t('auth.currentPassword', 'Current Initial Password')}
            type="password"
            id="currentPassword"
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="admin@123"
            required
            autoFocus
          />

          <Input
            label={t('auth.newPassword', 'New Secure Password')}
            type="password"
            id="newPassword"
            name="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Input
            label={t('auth.confirmPassword', 'Confirm New Password')}
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {/* Password Strength Checklist */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5 text-slate-700">
            <div className="font-semibold text-slate-800 mb-1">Password Requirements:</div>
            <div className="flex items-center gap-2">
              {hasMinLength ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
              <span className={hasMinLength ? 'text-green-700 font-medium' : ''}>At least 8 characters long</span>
            </div>
            <div className="flex items-center gap-2">
              {hasLetter ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
              <span className={hasLetter ? 'text-green-700 font-medium' : ''}>Contains at least one letter</span>
            </div>
            <div className="flex items-center gap-2">
              {hasNumber ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
              <span className={hasNumber ? 'text-green-700 font-medium' : ''}>Contains at least one number</span>
            </div>
            <div className="flex items-center gap-2">
              {hasSpecial ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
              <span className={hasSpecial ? 'text-green-700 font-medium' : ''}>Contains special symbol (!@#$%^&*)</span>
            </div>
            <div className="flex items-center gap-2">
              {isMatch ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
              <span className={isMatch ? 'text-green-700 font-medium' : ''}>Passwords match</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={handleLogout} disabled={loading}>
              {t('nav.logout', 'Cancel & Logout')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!hasMinLength || !hasLetter || !hasNumber || !hasSpecial || !isMatch}
            >
              {loading ? t('auth.updatingPassword', 'Updating...') : t('auth.changePasswordButton', 'Update Password & Proceed')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
