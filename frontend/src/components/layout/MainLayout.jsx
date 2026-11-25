import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export const MainLayout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-gov-surface text-slate-800">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        onMenuClick={() => setMobileMenuOpen(true)}
      />
      <div className="relative flex flex-1 items-stretch">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
        />
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          />
        )}
        <main className={`min-w-0 w-full flex-1 transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
          <div className="mx-auto w-full max-w-[1600px]">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
