import React from 'react';
import { Card, Typography, Grid, Box, useTheme } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HistoryIcon from '@mui/icons-material/History';

export default function Dashboard() {
  const theme = useTheme();
  return (
    <Box sx={{ p: { xs: 2, md: 5 }, bgcolor: theme.palette.grey[100], minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
        Dashboard
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, p: 2, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <DescriptionIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Scripts</Typography>
            <Typography color="text.secondary" align="center">Access and manage your scripts.</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, p: 2, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <FolderOpenIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Suites</Typography>
            <Typography color="text.secondary" align="center">View and organize your test suites.</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ borderRadius: 4, boxShadow: 4, p: 2, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <HistoryIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Recent Activity</Typography>
            <Typography color="text.secondary" align="center">See your latest actions and results.</Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
