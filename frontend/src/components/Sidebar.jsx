import React, { useState, useEffect } from 'react';
import { Drawer, Toolbar, List, ListItemButton, ListItemIcon, ListItemText, Divider, Box, Typography, Avatar, Button, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImportantDevicesIcon from '@mui/icons-material/ImportantDevices';
import SaveIcon from '@mui/icons-material/Save';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { Link, useLocation } from 'react-router-dom';
import { APP_NAME } from '../constants';

const Sidebar = ({ drawerWidth = 280, username = null, onLogout = null }) => {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const collapsedWidth = 72;

  // expose sidebar width as CSS variable so other components (footer) can adapt
  useEffect(() => {
    try {
      const val = `${open ? drawerWidth : collapsedWidth}px`;
      document.documentElement.style.setProperty('--sidebar-width', val);
    } catch (e) {}
    return () => {};
  }, [open, drawerWidth, collapsedWidth]);

  const items = [
    { text: 'Home', to: '/', icon: <HomeIcon /> },
    { text: 'Scripts', to: '/scripts', icon: <DescriptionIcon /> },
    { text: 'Script Browser', to: '/browser', icon: <FolderOpenIcon /> },
    { text: 'Suites Management', to: '/suites', icon: <SaveIcon /> },
  { text: 'Benches', to: '/benches', icon: <ImportantDevicesIcon /> },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? drawerWidth : collapsedWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : collapsedWidth,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'primary.dark',
          color: 'white',
          transition: (theme) => theme.transitions.create('width', { duration: 200 }),
          overflowX: 'hidden',
        },
      }}
    >
      <Toolbar sx={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', px: 1 }}>
        {open ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: 1 }}>
              {APP_NAME}
            </Typography>
          </Box>
        ) : (
          <Tooltip title={APP_NAME} placement="right">
            <Box />
          </Tooltip>
        )}
      </Toolbar>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
      <List sx={{ flex: 1 }}>
        {items.map((it) => (
          <ListItemButton
            key={it.to}
            component={Link}
            to={it.to}
            selected={location.pathname === it.to}
            sx={{
              my: 0.5,
              borderRadius: 2,
              mx: open ? 1 : 0,
              color: 'inherit',
              bgcolor: (theme) => (location.pathname === it.to ? 'primary.main' : 'inherit'),
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'white',
              },
              '&:hover': {
                bgcolor: 'primary.light',
                color: 'white',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit' }}>{it.icon}</ListItemIcon>
            {open && <ListItemText primary={it.text} />}
          </ListItemButton>
        ))}
      </List>

      {/* stronger visual separation before footer */}
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.18)', my: 0 }} />

      {/* User area: single-line when open, minimal when closed */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'secondary.main', fontSize: 20 }}>
            {username ? username.charAt(0).toUpperCase() : '?'}
          </Avatar>
          {open && (
            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'Unknown'}</Typography>
          )}
          {/* spacer to push actions to the right when open */}
          <Box sx={{ flex: 1 }} />
          {open ? (
            <Button size="small" variant="outlined" color="inherit" sx={{ borderColor: 'rgba(255,255,255,0.2)' }} onClick={onLogout} startIcon={<LogoutIcon />}>Logout</Button>
          ) : (
            <Tooltip title="Logout" placement="right">
              <IconButton size="small" onClick={onLogout} sx={{ color: 'inherit' }}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* center the toggle below the user block so it's visible when collapsed */}
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Tooltip title={open ? 'Collapse sidebar' : 'Open sidebar'} placement="top">
            <IconButton onClick={() => setOpen(v => !v)} sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.04)' }} size="small" aria-label={open ? 'collapse-sidebar' : 'open-sidebar'}>
              {open ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
