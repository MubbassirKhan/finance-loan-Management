import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Globe, History, Shield, Database } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const Header = () => {
  const { admin, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const isHistorical = location.pathname === '/historical';

  const handleHistoricalToggle = (targetMode) => {
    if (targetMode === 'historical') {
      navigate('/historical');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-gov-navy text-white border-b-4 border-gov-primary shadow-sm sticky top-0 z-40">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left Branding Area (Official government typography) */}
        <div className="flex items-center gap-3">
          {/* Logo Placeholder Badge */}
          <div className="w-10 h-10 rounded bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
            <Shield className="w-6 h-6 text-yellow-400" />
          </div>

          <div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight font-kannada">
              {t('app.orgName', 'Police Credit Co-operative Society')}
            </div>
            <div className="text-xs text-slate-300 font-medium">
              {t('app.title', 'Membership and Fund Management System')}
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Historical Data Toggle: [ Current System | Historical Data ] */}
          <div className="hidden md:flex items-center bg-white/10 rounded border border-white/20 p-0.5 text-xs font-semibold">
            <button
              onClick={() => handleHistoricalToggle('current')}
              className={`px-3 py-1.5 rounded transition ${
                !isHistorical
                  ? 'bg-gov-primary text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('nav.currentSystem', 'Current System (2027+)')}
            </button>
            <button
              onClick={() => handleHistoricalToggle('historical')}
              className={`px-3 py-1.5 rounded transition ${
                isHistorical
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('nav.historicalData', 'Historical Data')}
            </button>
          </div>

          {/* Language Toggle Button: [ English | ಕನ್ನಡ ] */}
          <div className="flex items-center bg-white/10 rounded border border-white/20 p-0.5 text-xs font-semibold">
            <button
              onClick={() => toggleLanguage('en')}
              className={`px-2.5 py-1 rounded transition ${
                language === 'en'
                  ? 'bg-white text-gov-navy shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => toggleLanguage('kn')}
              className={`px-2.5 py-1 rounded font-kannada transition ${
                language === 'kn'
                  ? 'bg-white text-gov-navy shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {/* Admin User Info & Logout */}
          {admin && (
            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-white/20">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  {admin.username}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">
                  {t('nav.admin', 'Administrator')}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-700 text-white rounded transition border border-red-900"
                title={t('nav.logout', 'Logout')}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('nav.logout', 'Logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
