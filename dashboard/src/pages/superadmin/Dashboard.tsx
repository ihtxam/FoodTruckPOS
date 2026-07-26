import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Overview from './Overview';
import Merchants from './Merchants';
import Licenses from './Licenses';
import Analytics from './Analytics';
import Settings from './Settings';

export default function SuperadminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { label: 'Overview', path: '/superadmin', icon: '📊' },
    { label: 'Merchants', path: '/superadmin/merchants', icon: '🏪' },
    { label: 'Licenses', path: '/superadmin/licenses', icon: '🔑' },
    { label: 'Analytics', path: '/superadmin/analytics', icon: '📈' },
    { label: 'Settings', path: '/superadmin/settings', icon: '⚙️' },
  ];

  return (
    <div className="flex h-screen panel-shell">
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        menuItems={menuItems}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header 
          title="Superadmin Dashboard"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-auto p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="merchants" element={<Merchants />} />
            <Route path="licenses" element={<Licenses />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
