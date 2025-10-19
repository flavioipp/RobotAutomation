import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getBenchById } from '../api';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { useToast } from '../components/ToastContext';
import { updateBench } from '../api';
import Stack from '@mui/material/Stack';
import { getUsers, getBrands, getEquipTypes } from '../api';

// BenchDetails: shows a readonly form with all fields available for a bench (for now)
export default function BenchDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const bench = location.state?.bench || null;
  const params = useParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(bench);
  const { showToast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(bench?.name || '');
  const [nameError, setNameError] = React.useState('');

  const isNameDirty = editing && (nameValue !== (data?.name ?? ''));
  const [users, setUsers] = React.useState([]);
  const [ownerValue, setOwnerValue] = React.useState(null); // will hold user object or null
  const isOwnerDirty = editing && ((ownerValue?.username || '') !== (data?.owner || ''));
  const [brands, setBrands] = React.useState([]);
  const [brandValue, setBrandValue] = React.useState(null);
  const isBrandDirty = editing && ((brandValue?.id || null) !== (data?.brand_id ?? null));
  const [equipTypes, setEquipTypes] = React.useState([]);
  const [equipTypeValue, setEquipTypeValue] = React.useState(null);
  const isEquipTypeDirty = editing && ((equipTypeValue?.id || null) !== (data?.equip_type_id ?? null));
  const isAnyDirty = isNameDirty || isOwnerDirty;

  React.useEffect(() => { setNameValue(data?.name || ''); }, [data]);
  React.useEffect(() => { setOwnerValue(data?.owner || ''); }, [data]);
  React.useEffect(() => {
    let mounted = true;
    getUsers().then((res) => { if (!mounted) return; setUsers(res || []); }).catch(() => { if (!mounted) return; setUsers([]); });
  getBrands().then((res) => { if (!mounted) return; setBrands(res || []); }).catch(() => { if (!mounted) return; setBrands([]); });
  getEquipTypes().then((res) => { if (!mounted) return; setEquipTypes(res || []); }).catch(() => { if (!mounted) return; setEquipTypes([]); });
    return () => { mounted = false; };
  }, []);

  // sync ownerValue object when users or data change
  React.useEffect(() => {
    if (!users || users.length === 0) return;
    const matched = users.find(u => u.username === data?.owner) || null;
    setOwnerValue(matched);
  }, [users, data]);

  React.useEffect(() => {
    if (!brands || brands.length === 0) return;
    const matched = brands.find(b => b.id === data?.brand_id) || null;
    setBrandValue(matched);
  }, [brands, data]);

  React.useEffect(() => {
    if (!equipTypes || equipTypes.length === 0) return;
    const matched = equipTypes.find(t => t.id === data?.equip_type_id) || null;
    setEquipTypeValue(matched);
  }, [equipTypes, data]);

  // when entering edit mode, ensure values are preselected from options if available
  React.useEffect(() => {
    if (!editing) return;
    if (users && users.length && !ownerValue) {
      setOwnerValue(users.find(u => u.username === data?.owner) || null);
    }
    if (brands && brands.length && !brandValue) {
      setBrandValue(brands.find(b => b.id === data?.brand_id) || null);
    }
    if (equipTypes && equipTypes.length && !equipTypeValue) {
      setEquipTypeValue(equipTypes.find(t => t.id === data?.equip_type_id) || null);
    }
  }, [editing, users, brands, equipTypes, data, ownerValue, brandValue, equipTypeValue]);

  React.useEffect(() => {
    let mounted = true;
    if (!data && params?.id) {
      setLoading(true);
      getBenchById(params.id).then((res) => {
        if (!mounted) return;
        setData(res);
      }).catch((e) => {
        console.error('Could not fetch bench by id', e);
        setError(e?.response?.data?.detail || e.message || 'Error fetching bench');
      }).finally(() => { if (mounted) setLoading(false); });
    }
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // If bench not passed, we could fetch by id here; for now show a message
  if (loading) return <Box sx={{ p: 2 }}><CircularProgress /></Box>;

  if (!data) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Bench details</Typography>
          {error ? (
            <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>
          ) : (
            <Typography variant="body2" sx={{ mt: 1 }}>No bench data was passed. Please open this page by clicking a bench row.</Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={() => navigate('/benches')}>Back to benches</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="h6">Bench: {data.name}</Typography>
            {isAnyDirty && <Chip label="Unsaved" color="warning" size="small" sx={{ ml: 1 }} />}
          </Box>
          <Stack direction="row" spacing={1}>
            {!editing ? (
              <Button variant="outlined" size="small" onClick={() => { setEditing(true); setNameValue(data.name || ''); }}>Edit</Button>
            ) : (
              <>
                <Button variant="contained" size="small" onClick={async () => {
                  // prepare payload with changed fields
                  const payload = {};
                  if (isNameDirty) {
                    if (!nameValue || String(nameValue).trim() === '') return showToast('Name cannot be empty', { type: 'warning' });
                    if (/\s/.test(nameValue)) return showToast('Name cannot contain whitespace', { type: 'warning' });
                    payload.name = nameValue;
                  }
                  if (isOwnerDirty) {
                    payload.owner_id = ownerValue?.id ?? null;
                  }
                  if (isBrandDirty) {
                    payload.brand_id = brandValue?.id ?? null;
                  }
                  if (isEquipTypeDirty) {
                    payload.equip_type_id = equipTypeValue?.id ?? null;
                  }
                  if (!Object.keys(payload).length) {
                    setEditing(false);
                    return;
                  }
                  try {
                    const res = await updateBench(data.id || data.id_equipment || params.id, payload);
                    // update local data
                    setData((d) => ({ ...d, ...(res.name ? { name: res.name } : {}), ...(res.owner ? { owner: res.owner } : {}), ...(res.owner_id ? { owner_id: res.owner_id } : {}), ...(res.brand_id ? { brand_id: res.brand_id } : {}) }));
                    showToast('Bench updated', { type: 'success' });
                    setEditing(false);
                  } catch (e) {
                    console.error('Could not update bench', e);
                    showToast('Could not update bench: ' + (e.response?.data?.detail || e.message), { type: 'error' });
                  }
                }}>Save</Button>
                <Button variant="outlined" size="small" onClick={() => { setEditing(false); setNameValue(data.name || ''); setOwnerValue(users.find(u => u.username === data.owner) || null); setBrandValue(brands.find(b => b.id === data.brand_id) || null); }}>Cancel</Button>
              </>
            )}
            <Button variant="outlined" size="small" onClick={() => navigate('/benches')}>Back</Button>
          </Stack>
        </Box>
        <Box component="form" sx={{ mt: 2, display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
          {Object.keys(data).map((k) => {
            if (k === 'name') {
              const isDirty = editing && (nameValue !== (data?.name ?? ''));
              return (
                <TextField
                  key={k}
                  label={k}
                  value={editing ? nameValue : String(data[k] ?? '')}
                  variant="outlined"
                  size="small"
                  onChange={(e) => {
                    if (!editing) return;
                    // remove any whitespace the user may have inserted (IME/paste fallback)
                    const sanitized = String(e.target.value).replace(/\s+/g, '');
                    setNameValue(sanitized);
                    if (nameError) setNameError('');
                  }}
                  onKeyDown={(e) => {
                    // block whitespace characters (space, tabs, etc.) inline
                    if (e.key && /^\s$/.test(e.key)) {
                      e.preventDefault();
                      setNameError('Whitespace characters are not allowed');
                      return;
                    }
                  }}
                  onPaste={(e) => {
                    // sanitize pasted text by removing whitespace
                    const pasted = e.clipboardData?.getData('text') || '';
                    const sanitized = pasted.replace(/\s+/g, '');
                    if (sanitized !== pasted) {
                      e.preventDefault();
                      // append sanitized content at end (simple behavior)
                      setNameValue((prev) => (prev || '') + sanitized);
                      setNameError('Whitespace characters removed from paste');
                    }
                  }}
                  InputProps={{ readOnly: !editing }}
                  error={Boolean(nameError)}
                  helperText={nameError}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: isDirty ? '#f97316' : undefined,
                      },
                      '&:hover fieldset': {
                        borderColor: isDirty ? '#f97316' : undefined,
                      },
                      boxShadow: isDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined,
                    }
                  }}
                />
              );
            }
            if (k === 'owner') {
              return (
                <Autocomplete
                  key={k}
                  freeSolo={false}
                  options={users}
                  getOptionLabel={(opt) => opt?.username || ''}
                  value={editing ? ownerValue : (users.find(u => u.username === data.owner) || null)}
                  onChange={(e, v) => { if (!editing) return; setOwnerValue(v || null); }}
                  disabled={!editing}
                  renderInput={(params) => (
                    (() => {
                      const ownerDirty = editing && ((ownerValue?.username || '') !== (data?.owner || ''));
                      return (
                        <TextField
                          {...params}
                          label={k}
                          variant="outlined"
                          size="small"
                          InputProps={{ ...params.InputProps, readOnly: !editing }}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': {
                                borderColor: ownerDirty ? '#f97316' : undefined,
                              },
                              '&:hover fieldset': {
                                borderColor: ownerDirty ? '#f97316' : undefined,
                              },
                              boxShadow: ownerDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined,
                            }
                          }}
                        />
                      );
                    })()
                  )}
                />
              );
            }
            // render brand selector only once, prefer 'brand_name' key
            if (k === 'brand_id' || k === 'brand') {
              return null;
            }
            if (k === 'brand_name') {
              // show brand selector when editing; map to the 'brand_id' field in the model
              return (
                <Autocomplete
                  key={k}
                  freeSolo={false}
                  options={brands}
                  getOptionLabel={(opt) => opt?.name || ''}
                  value={editing ? brandValue : (brands.find(b => b.id === data.brand_id) || null)}
                  onChange={(e, v) => { if (!editing) return; setBrandValue(v || null); }}
                  disabled={!editing}
                  renderInput={(params) => (
                    (() => {
                      const brandDirty = editing && ((brandValue?.id || null) !== (data?.brand_id ?? null));
                      return (
                        <TextField
                          {...params}
                          label={'brand'}
                          variant="outlined"
                          size="small"
                          InputProps={{ ...params.InputProps, readOnly: !editing }}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': {
                                borderColor: brandDirty ? '#f97316' : undefined,
                              },
                              '&:hover fieldset': {
                                borderColor: brandDirty ? '#f97316' : undefined,
                              },
                              boxShadow: brandDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined,
                            }
                          }}
                        />
                      );
                    })()
                  )}
                />
              );
            }
            // render equip_type selector only for 'equip_type' (skip equip_type_id)
            if (k === 'equip_type_id') {
              return null;
            }
            if (k === 'equip_type') {
              return (
                <Autocomplete
                  key={k}
                  freeSolo={false}
                  options={equipTypes}
                  getOptionLabel={(opt) => opt?.name || ''}
                  value={editing ? equipTypeValue : (equipTypes.find(t => t.id === data.equip_type_id) || (data.equip_type ? { id: data.equip_type_id ?? null, name: data.equip_type } : null))}
                  onChange={(e, v) => { if (!editing) return; setEquipTypeValue(v || null); }}
                  disabled={!editing}
                  renderInput={(params) => (
                    (() => {
                      const etDirty = editing && ((equipTypeValue?.id || null) !== (data?.equip_type_id ?? null));
                      return (
                        <TextField
                          {...params}
                          label={'equip_type'}
                          variant="outlined"
                          size="small"
                          InputProps={{ ...params.InputProps, readOnly: !editing }}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              '& fieldset': {
                                borderColor: etDirty ? '#f97316' : undefined,
                              },
                              '&:hover fieldset': {
                                borderColor: etDirty ? '#f97316' : undefined,
                              },
                              boxShadow: etDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined,
                            }
                          }}
                        />
                      );
                    })()
                  )}
                />
              );
            }
            return (
              <TextField
                key={k}
                label={k}
                value={String(data[k] ?? '')}
                variant="outlined"
                size="small"
                InputProps={{ readOnly: true }}
                sx={{ width: '100%' }}
              />
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
