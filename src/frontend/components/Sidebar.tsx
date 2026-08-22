import React from 'react';
import { House, Gear, Database, Terminal } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

export default function Sidebar() {
  const linkClass = "flex items-center gap-2 px-3 py-1.5 rounded-lg mx-2 transition-[0.2s] transition-colors text-gray-500 hover:bg-gray-950";
  const activeLinkClass = "text-slate-50 bg-gray-950";

  return (
    <aside className="hidden md:flex w-48 bg-black backdrop-blur-sm flex-col h-screen fixed top-0 left-0">
      <div className="h-12 flex items-center px-4">
        <h1 className="text-base font-bold text-gray-50">Paragon</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        <Link to="/" className={linkClass} activeProps={{ className: activeLinkClass }}>
          <House size={16} />
          <span className="text-xs">Dashboard</span>
        </Link>
        <Link to="/datasources" className={linkClass} activeProps={{ className: activeLinkClass }}>
          <Database size={16} />
          <span className="text-xs">Datasources</span>
        </Link>
        <Link to="/clients" className={linkClass} activeProps={{ className: activeLinkClass }}>
          <Terminal size={16} />
          <span className="text-xs">Clients</span>
        </Link>
        <Link to="/query" className={linkClass} activeProps={{ className: activeLinkClass }}>
          <Terminal size={16} />
          <span className="text-xs">Query</span>
        </Link>
        <Link to="/settings" className={linkClass} activeProps={{ className: activeLinkClass }}>
          <Gear size={16} />
          <span className="text-xs">Settings</span>
        </Link>
      </nav>
    </aside>
  );
}
