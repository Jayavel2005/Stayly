import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAdminStore } from './store/adminStore';
import { useAuthStore } from './store/authStore';
import { AdminHeader } from './features/header/AdminHeader';
import { AdminSidebar } from './features/sidebar/AdminSidebar';
import { AdminDashboardView } from './features/dashboard/AdminDashboardView';
import { UserDirectoryView } from './features/users/UserDirectoryView';
import { PropertiesView } from './features/properties/PropertiesView';
import { ManagerAssignmentView } from './features/managers/ManagerAssignmentView';
import { FinancialLedgerView } from './features/ledger/FinancialLedgerView';
import { RefundQueueView } from './features/refunds/RefundQueueView';
import { ReviewModerationView } from './features/reviews/ReviewModerationView';
import { PlatformSettingsView } from './features/settings/PlatformSettingsView';
import { AdminQuickSearchModal } from './features/quick-search/AdminQuickSearchModal';
import { AdminLoginPage } from './features/auth/AdminLoginPage';
import { AdminRegisterPage } from './features/auth/AdminRegisterPage';
import {
  LayoutDashboard,
  Users,
  Building2,
  Receipt,
  Scale,
  Sliders,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  const { activeTab, setActiveTab, theme } = useAdminStore();
  const { isAuthenticated } = useAuthStore();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboardView />;
      case 'users':
        return <UserDirectoryView />;
      case 'properties':
        return <PropertiesView />;
      case 'managers':
        return <ManagerAssignmentView />;
      case 'ledger':
        return <FinancialLedgerView />;
      case 'refunds':
        return <RefundQueueView />;
      case 'reviews':
        return <ReviewModerationView />;
      case 'settings':
        return <PlatformSettingsView />;
      default:
        return <AdminDashboardView />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        authView === 'register' ? (
          <AdminRegisterPage onBackToLogin={() => setAuthView('login')} />
        ) : (
          <AdminLoginPage
            onLoginSuccess={() => setActiveTab('dashboard')}
            onNavigateToRegister={() => setAuthView('register')}
          />
        )
      ) : (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
          {/* Global Admin Header */}
          <AdminHeader />

          <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
            {/* Desktop & Tablet Sidebar */}
            <div className="hidden md:block">
              <AdminSidebar />
            </div>

            {/* Main Viewport Container */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
              {renderActiveView()}
            </main>
          </div>

          {/* Mobile Sticky Bottom Navigation (< md breakpoint) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around z-40 px-2">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'dashboard' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Signals</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'users' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Users size={18} />
              <span>Users</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('properties')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'properties' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Building2 size={18} />
              <span>Hotels</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'ledger' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Receipt size={18} />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('refunds')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'refunds' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Scale size={18} />
              <span>Disputes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
                activeTab === 'settings' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              <Sliders size={18} />
              <span>Config</span>
            </button>
          </div>

          {/* Global Quick Search Command Palette (⌘K) */}
          <AdminQuickSearchModal />

          {/* Sonner Toast Notifications Container */}
          <Toaster
            position="top-right"
            theme={theme === 'dark' ? 'dark' : 'light'}
            richColors
            closeButton
          />
        </div>
      )}
    </QueryClientProvider>
  );
};

export default App;
