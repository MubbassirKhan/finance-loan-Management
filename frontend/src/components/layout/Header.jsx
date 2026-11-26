import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, CalendarDays, Clock3, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const Header = ({ onMenuClick, mobileMenuOpen = false }) => {
  const { admin, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const isHistorical = location.pathname === '/historical';
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now);

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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="border-b-2 border-amber-500 bg-gov-navy text-white">
        <div className="mx-auto flex min-h-8 max-w-[1600px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1 text-[11px] font-semibold sm:flex-nowrap sm:px-6 lg:px-8">
          <span className="min-w-0 truncate">
            <span className="font-kannada text-amber-300">ಕರ್ನಾಟಕ ಸರ್ಕಾರ</span>
            <span className="mx-2 text-white/40">|</span>
            <span className="hidden sm:inline">GOVERNMENT OF KARNATAKA</span>
            <span className="mx-2 hidden text-white/40 sm:inline">|</span>
            <span className="hidden md:inline">Karnataka State Police Department</span>
          </span>
          <div className="flex w-full shrink-0 items-center justify-between gap-3 text-[10px] sm:w-auto sm:justify-end sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sm:hidden">Live</span>
              <span className="hidden sm:inline">{t('nav.currentSystem', 'Current system')}</span>
            </span>
            <time dateTime={now.toISOString()} className="inline-flex items-center gap-2 whitespace-nowrap text-slate-100" aria-label={`Current date and time in India: ${dateLabel}, ${timeLabel}`}>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {dateLabel}
              </span>
              <span className="text-white/40" aria-hidden="true">|</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {timeLabel}
              </span>
            </time>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[76px] max-w-[1600px] items-center justify-between gap-3 px-3 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            aria-controls="primary-navigation"
            aria-expanded={mobileMenuOpen}
            title="Open navigation menu"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-300 text-gov-navy hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-primary lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 text-gov-navy sm:h-12 sm:w-12">
            <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase text-slate-500 sm:block">
              {t('app.department', 'Office of the Superintendent of Police')}
            </p>
            <h1 className="truncate text-sm font-bold leading-tight text-gov-navy sm:mt-0.5 sm:text-lg">
              {t('app.orgName', 'Police Credit Co-operative Society')}
            </h1>
            <p className="mt-0.5 line-clamp-1 text-[10px] font-medium leading-tight text-slate-600 sm:text-xs">
              {t('app.title', 'Membership and Fund Management System')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 text-xs font-semibold md:flex">
            <button
              type="button"
              onClick={() => handleHistoricalToggle('current')}
              aria-pressed={!isHistorical}
              className={`rounded px-2.5 py-1.5 transition ${!isHistorical ? 'bg-gov-navy text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              {t('nav.currentSystem', 'Current system')}
            </button>
            <button
              type="button"
              onClick={() => handleHistoricalToggle('historical')}
              aria-pressed={isHistorical}
              className={`rounded px-2.5 py-1.5 transition ${isHistorical ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              {t('nav.historicalData', 'Historical archive')}
            </button>
          </div>

          <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-semibold sm:text-xs">
            <button
              type="button"
              onClick={() => toggleLanguage('en')}
              aria-pressed={language === 'en'}
              className={`min-h-8 rounded px-2 transition sm:px-2.5 ${language === 'en' ? 'bg-slate-100 text-gov-navy' : 'text-slate-500 hover:text-slate-900'}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => toggleLanguage('kn')}
              aria-pressed={language === 'kn'}
              className={`min-h-8 rounded px-2 font-kannada transition sm:px-2.5 ${language === 'kn' ? 'bg-slate-100 text-gov-navy' : 'text-slate-500 hover:text-slate-900'}`}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {admin && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:gap-3 sm:pl-3">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-32 truncate text-xs font-bold text-slate-800">{admin.username}</p>
                <p className="text-[10px] font-medium text-emerald-700">{t('nav.admin', 'Administrator')}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-red-200 px-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:h-10 sm:px-3"
                title={t('nav.logout', 'Logout')}
                aria-label={t('nav.logout', 'Logout')}
              >
                <LogOut className="h-4 w-4" />
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
