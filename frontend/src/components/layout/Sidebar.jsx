import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Archive,
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  HandCoins,
  CalendarDays,
  Receipt,
  FolderArchive,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Sidebar = ({ collapsed = false, onCollapsedChange = () => {}, mobileOpen = false, onNavigate = () => {} }) => {
  const { t } = useLanguage();

  const navItems = [
    {
      to: '/dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      icon: LayoutDashboard,
    },
    {
      to: '/members',
      label: t('nav.members', 'Member Management'),
      icon: Users,
    },
    {
      to: '/police-stations',
      label: t('nav.policeStations', 'Police Stations / Units'),
      icon: ShieldCheck,
    },
    {
      to: '/membership-fees',
      label: t('nav.membershipFees', 'Membership Fees'),
      icon: CreditCard,
    },
    {
      to: '/loans',
      label: t('nav.loans', 'Loan Management'),
      icon: HandCoins,
    },
    {
      to: '/schedules',
      label: t('nav.schedules', 'Schedules'),
      icon: CalendarDays,
    },
    {
      to: '/loan-payments',
      label: t('nav.loanPayments', 'Loan Payments'),
      icon: Receipt,
    },
    {
      to: '/documents',
      label: t('nav.documents', 'Documents'),
      icon: FolderArchive,
    },
    {
      to: '/reports',
      label: t('nav.reports', 'Reports'),
      icon: FileSpreadsheet,
    },
    {
      to: '/settings',
      label: t('nav.settings', 'Settings'),
      icon: Settings,
    },
    {
      to: '/historical',
      label: t('nav.historicalData', 'Historical archive'),
      icon: Archive,
    },
  ];

  return (
    <aside
      aria-label="Primary navigation"
      id="primary-navigation"
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(84vw,18rem)] flex-col border-r border-slate-700 bg-gov-navy text-white shadow-xl transition-transform duration-200 lg:bottom-0 lg:top-[110px] lg:z-30 lg:h-auto lg:translate-x-0 lg:shadow-[2px_0_8px_rgba(11,31,53,0.12)] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
    >
      <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4 lg:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase text-amber-300">Navigation</p>
          <p className="text-sm font-bold text-white">SP Office System</p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close navigation menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded border border-white/20 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Main menu">
        <p className={`mb-3 px-3 text-[10px] font-bold uppercase text-slate-400 ${collapsed ? 'lg:sr-only' : ''}`}>
          {collapsed ? 'Menu' : 'Office services'}
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gov-primary ${
                  isActive
                    ? 'border-l-[3px] border-amber-400 bg-white/10 text-white'
                    : 'border-l-[3px] border-transparent text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="hidden min-h-10 w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
