import { useState, useEffect, useCallback } from 'react';
import { WalletProvider } from './context/WalletContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkGuard } from './components/NetworkGuard';
import { Header } from './components/Header';
import { AnnouncementStrip } from './components/AnnouncementStrip';
import { Breadcrumbs } from './components/Breadcrumbs';
import { FloatingHelp } from './components/FloatingHelp';
import { DebugPanel } from './components/DebugPanel';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { IssuerDashboard } from './pages/IssuerDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useWallet } from './hooks/useWallet';
import { useCertificateRegistry } from './hooks/useCertificateRegistry';

export type AppTab = 'home' | 'issue' | 'recipient' | 'verify';

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedCertId, setSelectedCertId] = useState<string | undefined>();
  const [isIssuer, setIsIssuer] = useState<boolean>(false);

  const { account, chainId } = useWallet();
  const { isIssuerAuthorized } = useCertificateRegistry();

  // Sync state with current URL pathname
  const syncRouteFromPath = useCallback(() => {
    const path = window.location.pathname;
    if (path.startsWith('/verify')) {
      const parts = path.split('/verify/');
      if (parts[1]) {
        setSelectedCertId(parts[1].split('?')[0].split('#')[0]);
      } else {
        setSelectedCertId(undefined);
      }
      setActiveTab('verify');
    } else if (path.startsWith('/issue')) {
      setActiveTab('issue');
    } else if (path.startsWith('/recipient')) {
      setActiveTab('recipient');
    } else {
      setActiveTab('home');
    }
  }, []);

  // Initial URL parsing
  useEffect(() => {
    syncRouteFromPath();
  }, [syncRouteFromPath]);

  // Handle browser Back / Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      syncRouteFromPath();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncRouteFromPath]);

  // Check if current connected wallet is authorized issuer
  useEffect(() => {
    if (account) {
      isIssuerAuthorized(account).then(setIsIssuer);
    } else {
      setIsIssuer(false);
    }
  }, [account, isIssuerAuthorized]);

  const handleNavigateToVerify = (certId: string, targetChainId?: number) => {
    const effectiveChain = targetChainId || chainId || 11155111;
    setSelectedCertId(certId);
    setActiveTab('verify');
    window.history.pushState({}, '', `/verify/${certId}?chain=${effectiveChain}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      window.history.pushState({}, '', '/');
    } else if (tab === 'verify') {
      window.history.pushState({}, '', '/verify');
      setSelectedCertId(undefined);
    } else {
      window.history.pushState({}, '', `/${tab}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const breadcrumbLabels: Record<AppTab, string> = {
    home: 'Home',
    issue: 'Issue Credential',
    recipient: 'My Certificates',
    verify: selectedCertId ? `Verify: ${selectedCertId.slice(0, 10)}...` : 'Verify Certificate',
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-azure-600 selection:text-white">
      {/* Network Guard Banner */}
      <NetworkGuard />

      {/* 3-Tier Sticky Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isIssuer={isIssuer}
      />

      {/* Announcement Strip */}
      <AnnouncementStrip />

      {/* Inner Page Breadcrumbs */}
      {activeTab !== 'home' && (
        <Breadcrumbs
          currentPage={breadcrumbLabels[activeTab]}
          onNavigateHome={() => handleSelectTab('home')}
        />
      )}

      {/* Main Page Routing */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === 'home' && (
          <HomePage
            onNavigateToTab={handleSelectTab}
            onNavigateToVerify={handleNavigateToVerify}
          />
        )}

        {activeTab === 'issue' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <IssuerDashboard onNavigateToVerify={handleNavigateToVerify} />
          </div>
        )}

        {activeTab === 'recipient' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <RecipientDashboard onNavigateToVerify={handleNavigateToVerify} />
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <VerifyCertificate initialCertId={selectedCertId} />
          </div>
        )}
      </main>

      {/* Floating Help Drawer Button */}
      <FloatingHelp />

      {/* Dev-Only Debug Panel */}
      <DebugPanel />

      {/* 4-Column Institutional Footer */}
      <Footer onSelectTab={handleSelectTab} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
}
