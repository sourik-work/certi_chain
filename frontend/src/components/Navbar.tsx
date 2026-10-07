import React from 'react';
import { Header } from './Header';

interface NavbarProps {
  activeTab: 'home' | 'issue' | 'recipient' | 'verify';
  onSelectTab: (tab: 'home' | 'issue' | 'recipient' | 'verify') => void;
  isIssuer: boolean;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  return <Header {...props} />;
};
