import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
// TableHead removed — headerless table
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import { getBenchesPage } from '../api';
import BusinessIcon from '@mui/icons-material/Business';
import SettingsIcon from '@mui/icons-material/Settings';
import PublicIcon from '@mui/icons-material/Public';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkIcon from '@mui/icons-material/Work';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';


// Benches (Devices Under Test) - shows Name and Brand columns
import './Benches.css';
const Benches = () => {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
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

  const navigate = useNavigate();

  // derive visible rows by applying filter to name and subtitle fields
  const visibleRows = (rows || []).filter((r) => {
    if (!filter || String(filter).trim() === '') return true;
    const q = String(filter).toLowerCase();
    // build searchable string from name and subtitle-related fields
    const parts = [r.name, r.ip, r.brand_name, r.equip_type, r.owner];
    // include inUse textual form
    if (typeof r.inUse !== 'undefined' && r.inUse !== null) parts.push(r.inUse ? 'in use' : 'available');
    const hay = parts.filter(Boolean).join(' | ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });

  return (
    <Box sx={{ p: 2, height: `calc(100vh - var(--app-header-height) - 24px)`, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          variant="outlined"
          placeholder="Filter by name, IP, brand, type, owner..."
          value={filter}
          onChange={(e) => { setFilter(e.target.value); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: filter ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setFilter('')} aria-label="clear filter">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ minWidth: 240 }}
        />
      </Box>
      
  <TableContainer component={Paper} sx={{ position: 'relative', flex: 1, overflow: 'auto', pt: 0 }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 2 }}>
            <CircularProgress />
          </Box>
        )}
  <Table size="small" stickyHeader>
          {/* header intentionally removed to present a headerless list-style table */}
          <TableBody>
            {visibleRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {typeof r.inUse !== 'undefined' && r.inUse !== null && (
                        <Tooltip title={r.inUse ? 'In use' : 'Available'}>
                          <span role="img" aria-label={r.inUse ? 'In use' : 'Available'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {r.inUse ? <WorkIcon fontSize="small" sx={{ color: '#d97706' }} className="bench-pulse" /> : <CheckCircleIcon fontSize="small" color="success" />}
                          </span>
                        </Tooltip>
                      )}
                      {r.ip && <span role="button" tabIndex={0} onClick={() => navigate(`/benches/${r.id}`, { state: { bench: r } })} className="bench-fixed" style={{ cursor: 'pointer' }}><PublicIcon fontSize="small" sx={{ color: '#6b7280' }} /><span className="bench-fixed-text" title={r.ip}>IP: {r.ip}</span></span>}
                      {r.brand_name ? (
                        <span role="button" tabIndex={0} onClick={() => navigate(`/benches/${r.id}`, { state: { bench: r } })} className="bench-brand" style={{ cursor: 'pointer' }}><BusinessIcon fontSize="small" sx={{ color: '#6b7280' }} /><span className="bench-brand-text" title={r.brand_name}>Brand: {r.brand_name}</span></span>
                      ) : (r.brand_id ? <span>Brand ID: {r.brand_id}</span> : null)}
                      {r.equip_type && <span role="button" tabIndex={0} onClick={() => navigate(`/benches/${r.id}`, { state: { bench: r } })} className="bench-fixed" style={{ cursor: 'pointer' }}><SettingsIcon fontSize="small" sx={{ color: '#6b7280' }} /><span className="bench-fixed-text" title={r.equip_type}>Type: {r.equip_type}</span></span>}
                      {r.owner && <span role="button" tabIndex={0} onClick={() => navigate(`/benches/${r.id}`, { state: { bench: r } })} className="bench-fixed" style={{ cursor: 'pointer' }}><PersonIcon fontSize="small" sx={{ color: '#6b7280' }} /><span className="bench-fixed-text" title={r.owner}>Owner: {r.owner}</span></span>}
                      {/* ID intentionally hidden from UI; kept as row key */}
                    </div>
                    
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!loading && visibleRows.length === 0) && (
              <TableRow>
                <TableCell colSpan={1} sx={{ textAlign: 'center' }}>No benches found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Hide pagination while a filter is active (client-side filtering on current page) */}
      {!filter && (
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
      )}
    </Box>
  );
};

export default Benches;
