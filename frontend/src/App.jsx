import React, { useState, useEffect } from "react";
import { ToastProvider } from './components/ToastContext';
import ScriptsTable from "./components/ScriptsTable";
import ScriptBrowser from "./components/ScriptBrowser";
import SavedSuites from './pages/SavedSuites';
import { APP_NAME } from './constants';
import Footer from "./components/Footer";
import PlaceholderCarousel from './components/PlaceholderCarousel';
import Login from "./Login";
import { setAuthToken, logout as apiLogout } from './api';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';

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
      <AppBar position="fixed" color="default" elevation={1} className="app-header">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography variant="h6">{APP_NAME}</Typography>
            {/* Navigation links */}
            <Button size="small" component={Link} to="/scripts">Scripts</Button>
            <Button size="small" component={Link} to="/browser">Script Browser</Button>
            <Button size="small" component={Link} to="/suites">Saved Suites</Button>
            <Button size="small" component={Link} to="/">Home</Button>
          </div>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {username && <Typography variant="body1">{username}</Typography>}
            <Avatar>{username ? username.charAt(0).toUpperCase() : '?'}</Avatar>
            <Button variant="outlined" size="small" onClick={() => setConfirmOpen(true)}>Logout</Button>
          </Box>
        </Toolbar>
      </AppBar>

      <main className="app-content" role="main">
        <Routes>
          <Route path="/" element={
            // Home / placeholder
            <div style={{ padding: 48, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#666' }}>
                <h2 style={{ marginTop: 0 }}>{APP_NAME}</h2>
                <div style={{ marginTop: 12 }}>
                  <PlaceholderCarousel />
                </div>
                {appLoading && <div style={{ marginTop: 12 }}><CircularProgress size={24} /></div>}
              </div>
            </div>
          } />
          <Route path="/scripts" element={<ScriptsTable onLoadingChange={setAppLoading} />} />
          <Route path="/browser" element={<ScriptBrowser />} />
          <Route path="/suites" element={<SavedSuites />} />
        </Routes>

        {/* Overlay loader when content is visible but ScriptsTable is loading */}
        {appLoading && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 64, bottom: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <CircularProgress />
          </div>
        )}
      </main>

      <Footer className="app-footer" />

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
