import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useManagerStore } from './store/managerStore';
import { AppHeader } from './features/header/AppHeader';
import { AppSidebar } from './features/sidebar/AppSidebar';
import { DashboardView } from './features/dashboard/DashboardView';
import { FrontDeskView } from './features/front-desk/FrontDeskView';
import { RoomInventoryView } from './features/rooms/RoomInventoryView';
import { RoomTypesView } from './features/room-types/RoomTypesView';
import { HousekeepingView } from './features/housekeeping/HousekeepingView';
import { ReviewsAuditView } from './features/reviews/ReviewsAuditView';
import { PropertyProfileView } from './features/property/PropertyProfileView';
import { QuickSearchModal } from './features/quick-search/QuickSearchModal';
import {
  LayoutDashboard,
  CalendarCheck,
  Grid3X3,
  Layers,
  Sparkles,
  Star,
  Settings,
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
  const { activeTab, setActiveTab, theme } = useManagerStore();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'front-desk':
        return <FrontDeskView />;
      case 'rooms':
        return <RoomInventoryView />;
      case 'room-types':
        return <RoomTypesView />;
      case 'housekeeping':
        return <HousekeepingView />;
      case 'reviews':
        return <ReviewsAuditView />;
      case 'property':
        return <PropertyProfileView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
        {/* Top Header */}
        <AppHeader />

        <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
          {/* Desktop & Tablet Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
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
            <span>Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('front-desk')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
              activeTab === 'front-desk' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <CalendarCheck size={18} />
            <span>Front Desk</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
              activeTab === 'rooms' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <Grid3X3 size={18} />
            <span>Rooms</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('housekeeping')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
              activeTab === 'housekeeping' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <Sparkles size={18} />
            <span>Turnover</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('property')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
              activeTab === 'property' ? 'text-primary font-bold' : 'text-muted-foreground'
            }`}
          >
            <Settings size={18} />
            <span>Property</span>
          </button>
        </div>

        {/* Global Quick Search Modal (⌘K) */}
        <QuickSearchModal />

        {/* Sonner Accessible Toast Alerts */}
        <Toaster
          position="top-right"
          theme={theme === 'dark' ? 'dark' : 'light'}
          richColors
          closeButton
        />
      </div>
    </QueryClientProvider>
  );
};

export default App;
