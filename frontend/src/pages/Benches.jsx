import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import { getBenchesPage } from '../api';

// Benches (Devices Under Test) - shows Name and Brand columns
const Benches = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getBenchesPage(limit, offset).then((data) => {
      if (!mounted) return;
      setRows(data.items || []);
      setTotal(data.total ?? null);
    }).catch((e) => {
      console.error('Could not load benches', e);
      setRows([]);
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [limit, offset]);

  return (
    <Box sx={{ p: 2, height: `calc(100vh - var(--app-header-height) - 24px)`, display: 'flex', flexDirection: 'column' }}>
      <TableContainer component={Paper} sx={{ position: 'relative', flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 2 }}>
            <CircularProgress />
          </Box>
        )}
  <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Brand</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.brand_name || r.brand_id || ''}</TableCell>
              </TableRow>
            ))}
            {(!loading && rows.length === 0) && (
              <TableRow>
                <TableCell colSpan={2} sx={{ textAlign: 'center' }}>No benches found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total ?? 0}
        page={Math.floor(offset / limit)}
        onPageChange={(e, newPage) => { setOffset(newPage * limit); }}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => { const v = parseInt(e.target.value, 10); setLimit(v); setOffset(0); }}
        rowsPerPageOptions={[10,25,50,100]}
        labelRowsPerPage="Rows"
      />
    </Box>
  );
};

export default Benches;
