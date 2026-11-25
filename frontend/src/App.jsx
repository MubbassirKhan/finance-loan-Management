import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import MainLayout from './components/layout/MainLayout.jsx'
import Loading from './components/common/Loading.jsx'

// Auth pages (not lazy – needed immediately)
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'

// Lazy-load all dashboard pages for faster initial load
const Dashboard            = lazy(() => import('./pages/Dashboard.jsx'))
const HistoricalComingSoon = lazy(() => import('./pages/HistoricalComingSoon.jsx'))
const NotFound             = lazy(() => import('./pages/NotFound.jsx'))
const Settings             = lazy(() => import('./pages/Settings.jsx'))

// Members
const MemberList    = lazy(() => import('./pages/members/MemberList.jsx'))
const MemberCreate  = lazy(() => import('./pages/members/MemberCreate.jsx'))
const MemberDetails = lazy(() => import('./pages/members/MemberDetails.jsx'))

// Police Stations
const StationList = lazy(() => import('./pages/police-stations/StationList.jsx'))
const StationForm = lazy(() => import('./pages/police-stations/StationForm.jsx'))

// Membership Fees
const MembershipFees = lazy(() => import('./pages/membership-fees/MembershipFees.jsx'))

// Loans / Payments / Documents / Reports (Coming Soon)
const LoanList     = lazy(() => import('./pages/loans/LoanList.jsx'))
const LoanPayments = lazy(() => import('./pages/loans/LoanPayments.jsx'))
const Documents    = lazy(() => import('./pages/documents/Documents.jsx'))
const Reports      = lazy(() => import('./pages/reports/Reports.jsx'))

// Fallback while lazy chunks load
const PageLoader = () => <Loading fullScreen message="Loading..." />

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public ─────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />

        {/* Change-password requires a valid session */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* ── Historical (no sidebar needed) ─────────────────── */}
        <Route
          path="/historical"
          element={
            <ProtectedRoute>
              <HistoricalComingSoon />
            </ProtectedRoute>
          }
        />

        {/* ── Protected with MainLayout ───────────────────────── */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Members */}
          <Route path="/members" element={<MemberList />} />
          <Route path="/members/create" element={<MemberCreate />} />
          <Route path="/members/:kgid/edit" element={<MemberCreate />} />
          <Route path="/members/:kgid" element={<MemberDetails />} />

          {/* Police Stations */}
          <Route path="/police-stations" element={<StationList />} />
          <Route path="/police-stations/create" element={<StationForm />} />
          <Route path="/police-stations/:ps_id/edit" element={<StationForm />} />

          {/* Membership Fees */}
          <Route path="/membership-fees" element={<MembershipFees />} />

          {/* Loans */}
          <Route path="/loans" element={<LoanList />} />
          <Route path="/loan-payments" element={<LoanPayments />} />

          {/* Documents */}
          <Route path="/documents" element={<Documents />} />

          {/* Reports */}
          <Route path="/reports" element={<Reports />} />

          {/* Settings */}
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* ── 404 ─────────────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default App
