import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Subscribers from './pages/Subscribers';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Bounces from './pages/Bounces';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="bounces" element={<Bounces />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function RequireAuth() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

import { Outlet, useNavigate } from 'react-router-dom';

function Layout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <span className="font-semibold text-slate-900">Newsletter Admin</span>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/" end className={navCls}>Dashboard</NavLink>
            <NavLink to="/subscribers" className={navCls}>Subscribers</NavLink>
            <NavLink to="/campaigns" className={navCls}>Campaigns</NavLink>
            <NavLink to="/bounces" className={navCls}>Bounces</NavLink>
          </nav>
          <button
            onClick={() => { logout(); nav('/login'); }}
            className="ml-auto text-sm text-slate-500 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function navCls({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'text-slate-900 font-medium border-b-2 border-slate-900 pb-3.5 -mb-px'
    : 'text-slate-500 hover:text-slate-900';
}
