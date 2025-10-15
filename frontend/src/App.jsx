import React, { useState, useEffect } from "react";
import { ToastProvider } from './components/ToastContext';
import ScriptsTable from "./components/ScriptsTable";
import ScriptBrowser from "./components/ScriptBrowser";
import SavedSuites from './pages/SavedSuites';
import Dashboard from './components/Dashboard.jsx';
import Sidebar from './components/Sidebar';
import CssBaseline from '@mui/material/CssBaseline';
import Login from "./Login";
import { setAuthToken, logout as apiLogout } from './api';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

function App() {
  const [token, setToken] = useState(null);
  // routing is handled by react-router
  const [appLoading, setAppLoading] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem('auth_token');
      if (t) {
        setAuthToken(t);
        setToken(t);
      }
    } catch (e) {}
  }, []);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const navigate = useNavigate();

  // read sidebar width from CSS var so main content moves when sidebar opens/closes
  const [sidebarWidth, setSidebarWidth] = useState(240);
  useEffect(() => {
    const read = () => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '240px';
        setSidebarWidth(parseInt(v.replace('px','').trim(), 10) || 240);
      } catch (e) {}
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', read);
    return () => { mo.disconnect(); window.removeEventListener('resize', read); };
  }, []);

  if (!token) {
    return <Login onLogin={(t) => { setAuthToken(t); setToken(t); navigate('/'); }} />;
  }

  const handleLogout = () => {
    try { apiLogout(); } catch (e) {}
    setToken(null);
    setAuthToken(null);
    navigate('/');
  };
  // decode username from JWT (simple base64 decode of payload)
  const getUsernameFromToken = (t) => {
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
      const payload = JSON.parse(json);
      return payload.sub || payload.username || null;
    } catch (e) {
      return null;
    }
  };

  const username = getUsernameFromToken(token);

  return (
    <ToastProvider>
    <div className="app-root">
      <CssBaseline />

  <Sidebar username={username} onLogout={() => setConfirmOpen(true)} />
  <main className="app-content" role="main" style={{ marginLeft: sidebarWidth, transition: 'margin-left 160ms ease' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scripts" element={<ScriptsTable onLoadingChange={setAppLoading} />} />
          <Route path="/browser" element={<ScriptBrowser />} />
          <Route path="/suites" element={<SavedSuites />} />
        </Routes>

        {/* Overlay loader when content is visible but ScriptsTable is loading */}
        {appLoading && (
          <div style={{ position: 'absolute', left: sidebarWidth, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <CircularProgress />
          </div>
        )}
  </main>



      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm logout</DialogTitle>
        <DialogContent>
          Are you sure you want to logout?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); handleLogout(); }} autoFocus>Logout</Button>
        </DialogActions>
      </Dialog>
    </div>
    </ToastProvider>
  );
}

export default App;
