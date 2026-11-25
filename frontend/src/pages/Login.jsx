import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

export const Login = () => {
  const { login } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage(t('common.required', 'Please enter username and password.'));
      return;
    }

    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      success(t('auth.signingIn', 'Sign in successful.'));

      if (data.admin?.must_change_password) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.message || t('auth.invalidCredentials', 'Invalid username or password.');
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Top Bar for Language Toggle */}
      <div className="bg-gov-navy text-white px-6 py-2.5 flex items-center justify-between border-b-2 border-gov-primary">
        <div className="text-xs font-semibold text-slate-300">
          {t('app.department', 'Karnataka State Police Department')}
        </div>
        <div className="flex items-center gap-1 bg-white/10 rounded border border-white/20 p-0.5 text-xs font-semibold">
          <button
            onClick={() => toggleLanguage('en')}
            className={`px-2.5 py-1 rounded transition ${
              language === 'en' ? 'bg-white text-gov-navy' : 'text-slate-300 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => toggleLanguage('kn')}
            className={`px-2.5 py-1 rounded font-kannada transition ${
              language === 'kn' ? 'bg-white text-gov-navy' : 'text-slate-300 hover:text-white'
            }`}
          >
            ಕನ್ನಡ
          </button>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded border border-slate-300 shadow-md overflow-hidden">
          {/* Official Emblem & Title Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-gov-navy flex items-center justify-center text-yellow-400 mb-3 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-bold text-gov-navy leading-tight font-kannada">
              {t('app.orgName', 'Police Credit Co-operative Society')}
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              {t('app.title', 'Membership and Fund Management System')}
            </p>
            <div className="mt-2 inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-gov-primary uppercase tracking-wide">
              {t('auth.loginSubtitle', 'Authorized Department Personnel Only')}
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
              label={t('auth.username', 'Username')}
              icon={User}
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
            />

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800 mb-1.5">
                {t('auth.password', 'Password')}
                <span className="text-red-600 ml-1 font-bold">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 transition-colors focus:border-gov-primary focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {loading ? t('auth.signingIn', 'Verifying...') : t('auth.loginButton', 'Sign In to System')}
            </Button>
          </form>

          {/* Footer Notice */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 text-center text-[11px] text-slate-500">
            Internal secure system. Unauthorized access attempts are monitored and recorded.
          </div>
        </div>
      </div>

      {/* Official Bottom Footer */}
      <footer className="text-center py-3 text-xs text-slate-500 border-t border-slate-200 bg-white">
        &copy; {new Date().getFullYear()} Superintendent of Police Office. All Rights Reserved.
      </footer>
    </div>
  );
};

export default Login;
