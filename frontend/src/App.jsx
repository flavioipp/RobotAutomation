import React, { useState, useEffect } from "react";
import { ToastProvider } from './components/ToastContext';
import ScriptsTable from "./components/ScriptsTable";
import ScriptBrowser from "./components/ScriptBrowser";
import SavedSuites from './pages/SavedSuites';
import Dashboard from './components/Dashboard.jsx';
import Sidebar from './components/Sidebar';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Login from "./Login";
import { setAuthToken, logout as apiLogout } from './api';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { useLocation } from 'react-router-dom';
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

  const location = useLocation();
  // read sidebar width from CSS var so main content moves when sidebar opens/closes
  // store as a pixel string (e.g. '240px') so alignment is exact with Sidebar's CSS variable
  const [sidebarWidth, setSidebarWidth] = useState('240px');
  useEffect(() => {
    const read = () => {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '240px';
        setSidebarWidth(v.trim());
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
  const appBarHeight = 64;
  const getPageMeta = (pathname) => {
    // simple mapping for sidebar routes to title/subtitle
    switch (pathname) {
      case '/scripts':
        return { title: 'Scripts', subtitle: 'Manage and run your scripts' };
      case '/browser':
        return { title: 'Script Browser', subtitle: 'Preview files and create suites' };
      case '/suites':
        return { title: 'Saved Suites', subtitle: 'Your saved test suites' };
      case '/':
      default:
        return { title: 'Dashboard', subtitle: 'Overview and quick actions' };
    }
  };

  const pageMeta = getPageMeta(location.pathname);

  return (
    <ToastProvider>
      <div className="app-root">
        <CssBaseline />

        <Sidebar username={username} onLogout={() => setConfirmOpen(true)} />

        <AppBar position="fixed" elevation={2} sx={{ left: sidebarWidth, width: `calc(100% - ${sidebarWidth})`, transition: 'left 160ms ease, width 160ms ease', zIndex: 1400, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Toolbar sx={{ minHeight: appBarHeight, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', pl: 3 }}>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
              {pageMeta.title}
            </Typography>
            {pageMeta.subtitle && (
              <Typography variant="caption" component="div" sx={{ opacity: 0.9 }}>
                {pageMeta.subtitle}
              </Typography>
            )}
          </Toolbar>
        </AppBar>
  <main className="app-content" role="main" style={{ marginLeft: sidebarWidth, marginTop: appBarHeight, transition: 'margin-left 160ms ease, margin-top 160ms ease' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scripts" element={<ScriptsTable onLoadingChange={setAppLoading} />} />
          <Route path="/browser" element={<ScriptBrowser />} />
          <Route path="/suites" element={<SavedSuites />} />
        </Routes>

        {/* Overlay loader when content is visible but ScriptsTable is loading */}
        {appLoading && (
          <div style={{ position: 'absolute', left: sidebarWidth, right: 0, top: appBarHeight, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
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
