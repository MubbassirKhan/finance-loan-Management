import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 max-w-7xl mx-auto w-full overflow-x-hidden">
          {/* Render children if passed directly, or Outlet for nested routes */}
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
