import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { AppProvider } from './context/AppContext';
import Dashboard from './Dashboard';

const AnalyticsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full relative bg-slate-50 dark:bg-black">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div
        className="min-h-screen min-w-0"
        style={{ marginLeft: isSidebarOpen ? 256 : 80, transition: 'margin-left 0.3s' }}
      >
        <AppProvider>
          <Dashboard />
        </AppProvider>
      </div>
    </div>
  );
};

export default AnalyticsPage;
