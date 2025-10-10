import React, { useState, useEffect } from "react";
import ScriptsTable from "./components/ScriptsTable";
import { APP_NAME } from './constants';
import Footer from "./components/Footer";
import PlaceholderCarousel from './components/PlaceholderCarousel';
import Login from "./Login";
import { setAuthToken, logout as apiLogout } from './api';
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
  const [showContent, setShowContent] = useState(false);
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

  if (!token) {
    return <Login onLogin={(t) => { setToken(t); setShowContent(false); }} />;
  }

  const handleLogout = () => {
    try { apiLogout(); } catch (e) {}
    setToken(null);
    setShowContent(false);
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
    <div className="app-root">
      <AppBar position="fixed" color="default" elevation={1} className="app-header">
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography variant="h6">{APP_NAME}</Typography>
            {/* Link/button to open the main app page (ScriptsTable) */}
            <Button size="small" onClick={() => setShowContent(prev => !prev)}>
              {showContent ? 'Home' : 'Open'}
            </Button>
          </div>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {username && <Typography variant="body1">{username}</Typography>}
            <Avatar>{username ? username.charAt(0).toUpperCase() : '?'}</Avatar>
            <Button variant="outlined" size="small" onClick={() => setConfirmOpen(true)}>Logout</Button>
          </Box>
        </Toolbar>
      </AppBar>

      <main className="app-content" role="main">
        {/* Keep ScriptsTable mounted so it can load repos/dirs even when hidden */}
        <div style={{ display: showContent ? 'block' : 'none' }}>
          <ScriptsTable onLoadingChange={setAppLoading} />
        </div>

        {!showContent && (
          // blank page placeholder shown on top while ScriptsTable is loading/hidden
          <div style={{ padding: 48, minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#666' }}>
              <h2 style={{ marginTop: 0 }}>{APP_NAME}</h2>
              <div style={{ marginTop: 12 }}>
                <PlaceholderCarousel />
              </div>
              {appLoading && <div style={{ marginTop: 12 }}><CircularProgress size={24} /></div>}
            </div>
          </div>
        )}

        {/* Overlay loader when content is visible but ScriptsTable is loading */}
        {showContent && appLoading && (
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
  );
}

export default App;
