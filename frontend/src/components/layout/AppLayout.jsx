import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        mobileOpen={mobileMenuOpen} 
        onCloseMobile={() => setMobileMenuOpen(false)}
        desktopOpen={desktopSidebarOpen}
        onToggleDesktop={() => setDesktopSidebarOpen(prev => !prev)}
      />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <Outlet 
          context={{ 
            onToggleMobileMenu: () => {
              if (window.innerWidth >= 1024) {
                setDesktopSidebarOpen(prev => !prev);
              } else {
                setMobileMenuOpen(prev => !prev);
              }
            },
            desktopSidebarOpen,
            onToggleDesktopSidebar: () => setDesktopSidebarOpen(prev => !prev)
          }} 
        />
      </div>
    </div>
  );
}
