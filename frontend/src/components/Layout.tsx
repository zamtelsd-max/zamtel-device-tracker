import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NavItem = ({ to, label, icon }: { to: string; label: string; icon: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-white text-zamtel-green'
          : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`
    }
  >
    <span className="text-lg">{icon}</span>
    {label}
  </NavLink>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = () => {
    const role = user?.role;
    const items = [];
    if (['project_manager', 'head_of_sales', 'project_lead', 'back_office'].includes(role || '')) {
      items.push({ to: '/dashboard', label: 'Dashboard', icon: '📊' });
    }
    if (['trade_auditor', 'project_lead'].includes(role || '')) {
      items.push({ to: '/devices-pool', label: 'Devices Pool', icon: '📱' });
      items.push({ to: '/my-devices', label: 'My Devices', icon: '🗂️' });
      items.push({ to: '/map-devices', label: 'Map Devices', icon: '📍' });
    }
    if (['project_manager', 'head_of_sales'].includes(role || '')) {
      items.push({ to: '/map-devices', label: 'Device Map', icon: '📍' });
    }
    if (['back_office', 'project_lead'].includes(role || '')) {
      items.push({ to: '/closure-queue', label: 'Closure Queue', icon: '✅' });
    }
    if (['project_manager', 'head_of_sales', 'project_lead'].includes(role || '')) {
      items.push({ to: '/reports', label: 'Reports', icon: '📈' });
      items.push({ to: '/network-import', label: 'Network Import', icon: '📡' });
    }
    if (role === 'project_lead') {
      items.push({ to: '/admin', label: 'Admin', icon: '⚙️' });
    }
    return items;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-zamtel-green shadow-xl transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'} min-h-screen`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/20">
          <div className="flex-shrink-0 w-8 h-8 bg-zamtel-pink rounded-full flex items-center justify-center text-white font-bold text-xs">Z</div>
          {sidebarOpen && (
            <div>
              <div className="text-white font-bold text-sm leading-tight">Zamtel</div>
              <div className="text-white/70 text-xs">Device Tracker</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-white/60 hover:text-white"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems().map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/20 px-4 py-4">
          {sidebarOpen && (
            <div className="mb-3">
              <div className="text-white font-medium text-sm truncate">{user?.name}</div>
              <div className="text-white/60 text-xs capitalize">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            <span>🚪</span>
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
