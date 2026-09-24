import { useState, useEffect } from 'react';
import { WalletProvider } from './context/WalletContext';
import { ToastProvider } from './context/ToastContext';
import { NetworkGuard } from './components/NetworkGuard';
import { Navbar } from './components/Navbar';
import { IssuerDashboard } from './pages/IssuerDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { useWallet } from './hooks/useWallet';
import { useCertificateRegistry } from './hooks/useCertificateRegistry';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'issue' | 'recipient' | 'verify'>('verify');
  const [selectedCertId, setSelectedCertId] = useState<string | undefined>();
  const [isIssuer, setIsIssuer] = useState<boolean>(false);

  const { account } = useWallet();
  const { isIssuerAuthorized } = useCertificateRegistry();

  // Listen to path changes or initial URL like /verify/0x123...
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/verify')) {
      const parts = path.split('/verify/');
      if (parts[1]) {
        setSelectedCertId(parts[1]);
      }
      setActiveTab('verify');
    } else if (path.startsWith('/issue')) {
      setActiveTab('issue');
    } else if (path.startsWith('/recipient')) {
      setActiveTab('recipient');
    }
  }, []);

  // Check if current connected wallet is authorized issuer
  useEffect(() => {
    if (account) {
      isIssuerAuthorized(account).then(setIsIssuer);
    } else {
      setIsIssuer(false);
    }
  }, [account, isIssuerAuthorized]);

  const handleNavigateToVerify = (certId: string) => {
    setSelectedCertId(certId);
    setActiveTab('verify');
    window.history.pushState({}, '', `/verify/${certId}`);
  };

  const handleSelectTab = (tab: 'issue' | 'recipient' | 'verify') => {
    setActiveTab(tab);
    if (tab !== 'verify') {
      window.history.pushState({}, '', `/${tab}`);
    } else {
      window.history.pushState({}, '', '/verify');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      <NetworkGuard />
      <Navbar activeTab={activeTab} onSelectTab={handleSelectTab} isIssuer={isIssuer} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'issue' && (
          <IssuerDashboard onNavigateToVerify={handleNavigateToVerify} />
        )}
        {activeTab === 'recipient' && (
          <RecipientDashboard onNavigateToVerify={handleNavigateToVerify} />
        )}
        {activeTab === 'verify' && (
          <VerifyCertificate initialCertId={selectedCertId} />
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <span>CertiChain Ledger • Decentralized Credential Protocol</span>
          <span>Solidity 0.8.24 • IPFS • RFC 8785 Hashing</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </WalletProvider>
  );
}
