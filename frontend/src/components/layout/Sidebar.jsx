import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  HandCoins,
  Receipt,
  FolderArchive,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const Sidebar = () => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

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
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200 transition-all duration-200 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      } flex-shrink-0 min-h-[calc(100vh-64px)] shadow-sm`}
    >
      {/* Navigation List */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-gov-primary text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-slate-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
