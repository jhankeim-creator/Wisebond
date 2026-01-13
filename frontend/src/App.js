import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LiveChat } from "@/components/LiveChat";
import { ScrollToTop } from "@/components/ScrollToTop";
import AnnouncementBar from "@/components/AnnouncementBar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
// InstallPrompt moved to Landing page footer

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Deposit from "@/pages/Deposit";
import Withdraw from "@/pages/Withdraw";
import Transfer from "@/pages/Transfer";
import Swap from "@/pages/Swap";
import Transactions from "@/pages/Transactions";
import KYC from "@/pages/KYC";
import Affiliate from "@/pages/Affiliate";
import Settings from "@/pages/Settings";
import VirtualCard from "@/pages/VirtualCard";
import TopUp from "@/pages/TopUp";
import AgentDeposit from "@/pages/AgentDeposit";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";

// Admin Pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminKYC from "@/pages/admin/AdminKYC";
import AdminDeposits from "@/pages/admin/AdminDeposits";
import AdminWithdrawals from "@/pages/admin/AdminWithdrawals";
import AdminRates from "@/pages/admin/AdminRates";
import AdminFees from "@/pages/admin/AdminFees";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminBulkEmail from "@/pages/admin/AdminBulkEmail";
import AdminVirtualCards from "@/pages/admin/AdminVirtualCards";
import AdminTopUp from "@/pages/admin/AdminTopUp";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminTeam from "@/pages/admin/AdminTeam";
import AdminAgentSettings from "@/pages/admin/AdminAgentSettings";
import AdminAgentDeposits from "@/pages/admin/AdminAgentDeposits";
import AdminAgentCommissionWithdrawals from "@/pages/admin/AdminAgentCommissionWithdrawals";
import AdminPaymentGateway from "@/pages/admin/AdminPaymentGateway";
import AdminWebhookEvents from "@/pages/admin/AdminWebhookEvents";
import AdminRBAC from "@/pages/admin/AdminRBAC";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isRoleAllowed } from "@/lib/adminRbac";

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, requiredRoles = null }) => {
  const { isAuthenticated, isAdmin, loading, adminRole } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EA580C]"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && isAdmin && Array.isArray(requiredRoles) && requiredRoles.length > 0) {
    if (!isRoleAllowed(adminRole, requiredRoles)) {
      return <Navigate to="/admin" replace />;
    }
  }
  
  return children;
};

// Public Route Component (redirects if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EA580C]"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      
      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/deposit" element={<ProtectedRoute><Deposit /></ProtectedRoute>} />
      <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
      <Route path="/swap" element={<ProtectedRoute><Swap /></ProtectedRoute>} />
      <Route path="/transfer" element={<ProtectedRoute><Transfer /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
      <Route path="/affiliate" element={<ProtectedRoute><Affiliate /></ProtectedRoute>} />
      <Route path="/virtual-card" element={<ProtectedRoute><ErrorBoundary><VirtualCard /></ErrorBoundary></ProtectedRoute>} />
      <Route path="/topup" element={<ProtectedRoute><TopUp /></ProtectedRoute>} />
      <Route path="/agent-deposit" element={<ProtectedRoute><AgentDeposit /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly requiredRoles={['support','finance','manager','admin','superadmin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly requiredRoles={['support','manager','admin','superadmin']}><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/kyc" element={<ProtectedRoute adminOnly requiredRoles={['support','manager','admin','superadmin']}><AdminKYC /></ProtectedRoute>} />
      <Route path="/admin/deposits" element={<ProtectedRoute adminOnly requiredRoles={['finance','manager','admin','superadmin']}><AdminDeposits /></ProtectedRoute>} />
      <Route path="/admin/withdrawals" element={<ProtectedRoute adminOnly requiredRoles={['finance','manager','admin','superadmin']}><AdminWithdrawals /></ProtectedRoute>} />
      <Route path="/admin/rates" element={<ProtectedRoute adminOnly requiredRoles={['finance','admin','superadmin']}><AdminRates /></ProtectedRoute>} />
      <Route path="/admin/fees" element={<ProtectedRoute adminOnly requiredRoles={['finance','admin','superadmin']}><AdminFees /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute adminOnly requiredRoles={['admin','superadmin']}><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/bulk-email" element={<ProtectedRoute adminOnly requiredRoles={['manager','admin','superadmin']}><AdminBulkEmail /></ProtectedRoute>} />
      <Route path="/admin/virtual-cards" element={<ProtectedRoute adminOnly requiredRoles={['support','finance','manager','admin','superadmin']}><AdminVirtualCards /></ProtectedRoute>} />
      <Route path="/admin/topup" element={<ProtectedRoute adminOnly requiredRoles={['support','finance','manager','admin','superadmin']}><AdminTopUp /></ProtectedRoute>} />
      <Route path="/admin/logs" element={<ProtectedRoute adminOnly requiredRoles={['manager','admin','superadmin']}><AdminLogs /></ProtectedRoute>} />
      <Route path="/admin/webhook-events" element={<ProtectedRoute adminOnly requiredRoles={['manager','admin','superadmin']}><AdminWebhookEvents /></ProtectedRoute>} />
      <Route path="/admin/team" element={<ProtectedRoute adminOnly requiredRoles={['superadmin']}><AdminTeam /></ProtectedRoute>} />
      <Route path="/admin/agent-settings" element={<ProtectedRoute adminOnly requiredRoles={['manager','finance','admin','superadmin']}><AdminAgentSettings /></ProtectedRoute>} />
      <Route path="/admin/agent-deposits" element={<ProtectedRoute adminOnly requiredRoles={['manager','finance','admin','superadmin']}><AdminAgentDeposits /></ProtectedRoute>} />
      <Route path="/admin/agent-commission-withdrawals" element={<ProtectedRoute adminOnly requiredRoles={['manager','finance','admin','superadmin']}><AdminAgentCommissionWithdrawals /></ProtectedRoute>} />
      <Route path="/admin/payment-gateway" element={<ProtectedRoute adminOnly requiredRoles={['finance','manager','admin','superadmin']}><AdminPaymentGateway /></ProtectedRoute>} />
      <Route path="/admin/rbac" element={<ProtectedRoute adminOnly requiredRoles={['admin','superadmin']}><AdminRBAC /></ProtectedRoute>} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AnnouncementBar />
            <div className="has-mobile-nav">
              <AppRoutes />
            </div>
            <MobileBottomNav />
            <LiveChat />
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
