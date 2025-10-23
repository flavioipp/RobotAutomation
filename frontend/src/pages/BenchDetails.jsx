import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getBenchById } from '../api';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ConfirmDialog from '../components/ConfirmDialog';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Autocomplete from '@mui/material/Autocomplete';
import { useToast } from '../components/ToastContext';
import { updateBench } from '../api';
import Stack from '@mui/material/Stack';
import { getUsers, getBrands, getEquipTypes, getLibsForEquipType, getLibs, revealCredential, updateCredential, deleteCredential, createCredential, getCredentialTypes } from '../api';

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
  const [descriptionValue, setDescriptionValue] = React.useState(data?.description ?? '');
  const isDescriptionDirty = editing && (descriptionValue !== (data?.description ?? ''));
  const [libs, setLibs] = React.useState([]);
  const [libValue, setLibValue] = React.useState(null);
  const isLibDirty = editing && ((libValue?.id || null) !== (data?.lib_id ?? null));
  const isAnyDirty = isNameDirty || isOwnerDirty || isBrandDirty || isEquipTypeDirty || isDescriptionDirty || isLibDirty;
  const [maskValue, setMaskValue] = React.useState('');
  const [gwValue, setGwValue] = React.useState('');
  const [ipValue, setIpValue] = React.useState('');
  const [ipError, setIpError] = React.useState('');
  const [maskError, setMaskError] = React.useState('');
  const [gwError, setGwError] = React.useState('');
  const isMaskDirty = editing && (maskValue !== (data?.mask ?? ''));
  const isGwDirty = editing && (gwValue !== (data?.gateway ?? ''));
  const isIpDirty = editing && (ipValue !== (data?.ip ?? ''));
  // include mask/gateway in overall dirty
  const isAnyDirtyFinal = isAnyDirty || isMaskDirty || isGwDirty || isIpDirty;

  // map of cred_id -> revealed plaintext pwd (kept in-memory only)
  const [revealedSecrets, setRevealedSecrets] = React.useState({});

  // per-row credential editing state
  const [editingCredId, setEditingCredId] = React.useState(null);
  const [editValues, setEditValues] = React.useState({ usr: '', port: '', pwd: '' });
  const [showEditPwd, setShowEditPwd] = React.useState(false);
  // adding new credential
  const [addingNew, setAddingNew] = React.useState(false);
  const [newCredValues, setNewCredValues] = React.useState({ type_id: '', usr: '', port: '', pwd: '' });
  const [credentialTypes, setCredentialTypes] = React.useState([]);

  const isNewCredValid = React.useMemo(() => {
    try {
      const typeId = Number(newCredValues.type_id);
      const hasType = credentialTypes.some(t => t.id === typeId);
      const usrOk = (newCredValues.usr || '').toString().trim() !== '';
      const portOk = (newCredValues.port || '').toString().trim() !== '';
      const pwdOk = (newCredValues.pwd || '').toString().trim() !== '';
      return hasType && usrOk && portOk && pwdOk;
    } catch (e) {
      return false;
    }
  }, [newCredValues, credentialTypes]);
  // dialog state for delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [toDeleteCred, setToDeleteCred] = React.useState(null);

  

  const maskSecret = (s) => {
    const dot = '•';
    if (!s) return dot.repeat(8); // default mask length
    try {
      return dot.repeat(s.length);
    } catch (e) {
      return dot.repeat(8);
    }
  };

  const handleReveal = async (credId) => {
    if (!credId) return;
    // toggle: if already revealed, hide
    if (revealedSecrets[credId]) {
      setRevealedSecrets((s) => { const copy = { ...s }; delete copy[credId]; return copy; });
      return;
    }
    try {
      const benchId = data?.id || params?.id;
      const res = await revealCredential(benchId, credId);
      setRevealedSecrets((s) => ({ ...s, [credId]: res.pwd }));
    } catch (e) {
      console.error('Could not reveal credential', e);
      showToast('Could not reveal credential: ' + (e.response?.data?.detail || e.message), { type: 'error' });
    }
  };

  const startEditCred = (c) => {
    if (!c || !c.cred_id) return;
    setEditingCredId(c.cred_id);
    setEditValues({ usr: c?.usr || '', port: c?.port ?? '', pwd: '' });
    setShowEditPwd(false);
  };

  const cancelEditCred = () => {
    setEditingCredId(null);
    setEditValues({ usr: '', port: '', pwd: '' });
    setShowEditPwd(false);
  };

  const saveEditCred = async (c) => {
    if (!c || !c.cred_id) return;
    const benchId = data?.id || params?.id;
    const payload = {};
    if (editValues.usr !== (c.usr || '')) payload.usr = editValues.usr || null;
    // allow empty port to be null
    const portVal = editValues.port === '' ? null : Number(editValues.port);
    if ((c.port ?? null) !== portVal) payload.port = portVal;
    if (editValues.pwd && editValues.pwd.length > 0) payload.pwd = editValues.pwd;
    if (!Object.keys(payload).length) {
      // nothing changed
      cancelEditCred();
      return;
    }
    try {
      const res = await updateCredential(benchId, c.cred_id, payload);
      // update local data.credentials by replacing the modified row
      setData((d) => {
        const creds = Array.isArray(d.credentials) ? [...d.credentials] : [];
        const idx = creds.findIndex(x => x.cred_id === c.cred_id);
        if (idx >= 0) {
          // merge server response into row (pwd will be redacted by server)
          creds[idx] = { ...creds[idx], ...res };
        }
        return { ...d, credentials: creds };
      });
      // clear any revealed secret cached for this cred
      setRevealedSecrets((s) => { const copy = { ...s }; delete copy[c.cred_id]; return copy; });
      showToast('Credential updated', { type: 'success' });
      cancelEditCred();
    } catch (e) {
      console.error('Could not update credential', e);
      showToast('Could not update credential: ' + (e.response?.data?.detail || e.message), { type: 'error' });
    }
  };

  const handleDeleteCred = async (c) => {
    if (!c || !c.cred_id) return;
    // open confirmation dialog
    setToDeleteCred(c);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCred = async () => {
    const c = toDeleteCred;
    if (!c || !c.cred_id) {
      setDeleteDialogOpen(false);
      setToDeleteCred(null);
      return;
    }
    const benchId = data?.id || params?.id;
    try {
      await deleteCredential(benchId, c.cred_id);
      setData((d) => ({ ...d, credentials: Array.isArray(d.credentials) ? d.credentials.filter(x => x.cred_id !== c.cred_id) : [] }));
      setRevealedSecrets((s) => { const copy = { ...s }; delete copy[c.cred_id]; return copy; });
      showToast('Credential deleted', { type: 'success' });
    } catch (e) {
      console.error('Could not delete credential', e);
      showToast('Could not delete credential: ' + (e.response?.data?.detail || e.message), { type: 'error' });
    }
    setDeleteDialogOpen(false);
    setToDeleteCred(null);
  };

  const cancelDeleteCred = () => {
    setDeleteDialogOpen(false);
    setToDeleteCred(null);
  };

  // no convenience first credential id anymore

  React.useEffect(() => { setNameValue(data?.name || ''); setMaskValue(data?.mask ?? ''); setGwValue(data?.gateway ?? ''); setIpValue(data?.ip ?? ''); }, [data]);
  React.useEffect(() => { setDescriptionValue(data?.description ?? ''); }, [data]);
  // simple IPv4 validation helpers
  const isValidIPv4 = (s) => {
    if (!s || typeof s !== 'string') return false;
    const parts = s.split('.');
    if (parts.length !== 4) return false;
    for (const p of parts) {
      if (!/^[0-9]+$/.test(p)) return false;
      const n = Number(p);
      if (n < 0 || n > 255) return false;
    }
    return true;
  };
  const isValidMask = (s) => {
    // accept either dotted-decimal mask or CIDR suffix like /24
    if (!s || typeof s !== 'string') return false;
    if (s.startsWith('/')) {
      const m = Number(s.slice(1));
      return Number.isInteger(m) && m >= 0 && m <= 32;
    }
    // dotted mask
    return isValidIPv4(s);
  };
  const validateIpFields = () => {
    let ok = true;
    if (editing) {
      if (ipValue && !isValidIPv4(ipValue)) { setIpError('Invalid IPv4 address'); ok = false; } else setIpError('');
      if (maskValue && !isValidMask(maskValue)) { setMaskError('Invalid mask (use /24 or 255.255.255.0)'); ok = false; } else setMaskError('');
      if (gwValue && !isValidIPv4(gwValue)) { setGwError('Invalid IPv4 gateway'); ok = false; } else setGwError('');
    } else {
      setIpError(''); setMaskError(''); setGwError('');
    }
    return ok;
  };
  // keep ownerValue as an object (or null). If data contains an owner string, keep a fallback
  React.useEffect(() => { setOwnerValue(data?.owner ? { id: null, username: data.owner } : null); }, [data]);
  React.useEffect(() => {
    let mounted = true;
    getUsers().then((res) => { if (!mounted) return; setUsers(res || []); }).catch(() => { if (!mounted) return; setUsers([]); });
  getBrands().then((res) => { if (!mounted) return; setBrands(res || []); }).catch(() => { if (!mounted) return; setBrands([]); });
  getEquipTypes().then((res) => { if (!mounted) return; setEquipTypes(res || []); }).catch(() => { if (!mounted) return; setEquipTypes([]); });
    return () => { mounted = false; };
  }, []);

  // fetch libs filtered by equip type when entering edit mode or when equipTypeValue changes
  React.useEffect(() => {
    let mounted = true;
    const fetchFiltered = async () => {
      try {
        // determine equip type id: prefer selected value, fallback to data from server
        let etId = (equipTypeValue && equipTypeValue.id) || data?.equip_type_id || null;
        // if we're editing but don't have an equip_type id yet, try fetching the full bench by id
        if (editing && !etId && params?.id) {
          try {
            const full = await getBenchById(params.id);
            if (!mounted) return;
            setData(full);
            etId = full?.equip_type_id ?? null;
          } catch (err) {
            // ignore — we'll fallback to loading all libs
          }
        }

        if (editing && etId) {
          const res = await getLibsForEquipType(etId);
          if (!mounted) return;
          setLibs(res || []);
        } else {
          // fallback: load all libs
          const res = await getLibs();
          if (!mounted) return;
          setLibs(res || []);
        }
      } catch (e) {
        if (!mounted) return;
        setLibs([]);
      }
    };
    fetchFiltered();
    return () => { mounted = false; };
  }, [editing, equipTypeValue, data?.equip_type_id, params.id]);

  // sync ownerValue object when users or data change
  React.useEffect(() => {
    if (!users || users.length === 0) return;
    const matched = users.find(u => u.username === data?.owner) || null;
    setOwnerValue(matched);
  }, [users, data]);

  React.useEffect(() => {
    // try to match a brand option; if none found, create a fallback so Autocomplete shows the name
    const matched = (brands && brands.length) ? (brands.find(b => b.id === data?.brand_id) || null) : null;
    if (matched) {
      setBrandValue(matched);
    } else if (data?.brand_name) {
      setBrandValue({ id: data?.brand_id ?? null, name: data.brand_name });
    } else {
      setBrandValue(null);
    }
  }, [brands, data]);

  React.useEffect(() => {
    // try to match an equip type option; if none found, create a fallback so Autocomplete shows the name
    const matched = (equipTypes && equipTypes.length) ? (equipTypes.find(t => t.id === data?.equip_type_id) || null) : null;
    if (matched) {
      setEquipTypeValue(matched);
    } else if (data?.equip_type) {
      setEquipTypeValue({ id: data?.equip_type_id ?? null, name: data.equip_type });
    } else {
      setEquipTypeValue(null);
    }
  }, [equipTypes, data]);

  React.useEffect(() => {
    const matched = (libs && libs.length) ? (libs.find(l => l.id === data?.lib_id) || null) : null;
    if (matched) {
      setLibValue(matched);
    } else if (data?.lib_name) {
      setLibValue({ id: data?.lib_id ?? null, name: data.lib_name });
    } else {
      setLibValue(null);
    }
  }, [libs, data]);

  // If user changes equip type while editing and the current T_LIB isn't in the
  // newly filtered libs, auto-select the first available lib.
  React.useEffect(() => {
    if (!editing) return;
    if (!libs || libs.length === 0) return;
    try {
      const currentId = (libValue && libValue.id) || data?.lib_id || null;
      const exists = libs.some(l => l.id === currentId);
      if (!exists) {
        // automatically pick the first available lib for the selected equip type
        const previousName = (libValue && libValue.name) || data?.lib_name || null;
        setLibValue(libs[0]);
        // notify user that Lib Version was changed automatically
        if (previousName) {
          showToast(`Lib Version changed from "${previousName}" to "${libs[0].name}"`, { type: 'info' });
        } else {
          showToast(`Lib Version set to "${libs[0].name}"`, { type: 'info' });
        }
      }
    } catch (e) {
      // ignore
    }
  }, [editing, equipTypeValue, libs, libValue, data?.lib_id, data?.lib_name, showToast]);

  // when entering edit mode, ensure values are preselected from options if available
  React.useEffect(() => {
    if (!editing) return;
    if (users && users.length && !ownerValue) {
      setOwnerValue(users.find(u => u.username === data?.owner) || (data?.owner ? { id: null, username: data.owner } : null));
    }
    if (brands && brands.length && !brandValue) {
      setBrandValue(brands.find(b => b.id === data?.brand_id) || (data?.brand_name ? { id: data?.brand_id ?? null, name: data.brand_name } : null));
    }
    if (equipTypes && equipTypes.length && !equipTypeValue) {
      setEquipTypeValue(equipTypes.find(t => t.id === data?.equip_type_id) || (data?.equip_type ? { id: data?.equip_type_id ?? null, name: data.equip_type } : null));
    } else if ((!equipTypes || equipTypes.length === 0) && !equipTypeValue && data?.equip_type) {
      // options not yet loaded; ensure a fallback so the field shows the current name
      setEquipTypeValue({ id: data?.equip_type_id ?? null, name: data.equip_type });
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

  // fetch credential types for Add/Edit
  React.useEffect(() => {
    let mounted = true;
    const loadTypes = async () => {
      try {
        const res = await getCredentialTypes();
        if (!mounted) return;
        setCredentialTypes(res || []);
      } catch (e) {
        if (!mounted) return;
        setCredentialTypes([]);
      }
    };
    loadTypes();
    return () => { mounted = false; };
  }, []);

  // compute whether the credentials table should scroll (show at most 3 rows)
  const _credsList = Array.isArray(data?.credentials) ? data.credentials : [];
  const _totalCredentialRows = _credsList.length + (addingNew ? 1 : 0);
  const _shouldCredentialScroll = _totalCredentialRows > 3;
  // stateful maxHeight so it updates after deletes/changes
  const [credentialsMaxHeight, setCredentialsMaxHeight] = React.useState(_shouldCredentialScroll ? (3 * 48 + 56) : undefined);

  React.useEffect(() => {
    const compute = () => {
      const should = (_credsList.length + (addingNew ? 1 : 0)) > 3;
      const mh = should ? (3 * 48 + 56) : undefined;
      setCredentialsMaxHeight(mh);
    };
    compute();
    let tid = null;
    const onResize = () => { if (tid) clearTimeout(tid); tid = setTimeout(() => { compute(); tid = null; }, 120); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (tid) clearTimeout(tid); };
  }, [_credsList.length, addingNew]);

  // renderKeys was previously used for grid rendering; not needed with explicit two-column layout

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
            {isAnyDirtyFinal && <Chip label="Unsaved" color="warning" size="small" sx={{ ml: 1 }} />}
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
                  if (isLibDirty) {
                    payload.lib_id = libValue?.id ?? null;
                  }
                  if (isDescriptionDirty) {
                    payload.description = descriptionValue || null;
                  }
                  if (isIpDirty) {
                    payload.ip = ipValue || null;
                  }
                  // always include mask/gateway values from the form so backend updates NM/GW for the target IP
                  payload.mask = maskValue || null;
                  payload.gateway = gwValue || null;
                  if (!Object.keys(payload).length) {
                    setEditing(false);
                    return;
                  }
                  try {
                    const res = await updateBench(data.id || data.id_equipment || params.id, payload);
                    // update local data including network fields returned by backend
                    setData((d) => ({
                      ...d,
                      ...(res.name ? { name: res.name } : {}),
                      ...(res.owner ? { owner: res.owner } : {}),
                      ...(res.owner_id ? { owner_id: res.owner_id } : {}),
                      ...(res.brand_id ? { brand_id: res.brand_id } : {}),
                      ...(res.ip !== undefined ? { ip: res.ip } : {}),
                      ...(res.mask !== undefined ? { mask: res.mask } : {}),
                      ...(res.gateway !== undefined ? { gateway: res.gateway } : {}),
                      ...(res.description !== undefined ? { description: res.description } : {}),
                      ...(res.lib_id !== undefined ? { lib_id: res.lib_id } : {}),
                      ...(res.lib_name !== undefined ? { lib_name: res.lib_name } : {}),
                    }));
                    // ensure local edit state matches server response
                    if (res.ip !== undefined) setIpValue(res.ip);
                    if (res.mask !== undefined) setMaskValue(res.mask ?? '');
                    if (res.gateway !== undefined) setGwValue(res.gateway ?? '');
                    if (res.description !== undefined) setDescriptionValue(res.description ?? '');
                    if (res.lib_id !== undefined || res.lib_name !== undefined) {
                      setLibValue(res.lib_id !== undefined ? { id: res.lib_id, name: res.lib_name ?? '' } : (res.lib_name !== undefined ? { id: data?.lib_id ?? null, name: res.lib_name } : libValue));
                    }
                    showToast('Bench updated', { type: 'success' });
                    setEditing(false);
                  } catch (e) {
                    console.error('Could not update bench', e);
                    showToast('Could not update bench: ' + (e.response?.data?.detail || e.message), { type: 'error' });
                  }
                }}>Save</Button>
                <Button variant="outlined" size="small" onClick={() => { setEditing(false); setNameValue(data.name || ''); setOwnerValue(users.find(u => u.username === data.owner) || null); setBrandValue(brands.find(b => b.id === data.brand_id) || null); setMaskValue(data?.mask ?? ''); setGwValue(data?.gateway ?? ''); setIpValue(data?.ip ?? ''); setEquipTypeValue(equipTypes.find(t => t.id === data.equip_type_id) || (data?.equip_type ? { id: data?.equip_type_id ?? null, name: data.equip_type } : null)); setDescriptionValue(data?.description ?? ''); setLibValue(libs.find(l => l.id === data?.lib_id) || (data?.lib_name ? { id: data?.lib_id ?? null, name: data.lib_name } : null)); }}>Cancel</Button>
              </>
            )}
            <Button variant="outlined" size="small" onClick={() => navigate('/benches')}>Back</Button>
          </Stack>
        </Box>
        <Box component="form" sx={{ mt: 2, display: 'flex', gap: 2 }}>
          {/* Left column: id, owner, network */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {data?.id !== undefined && (
              <TextField label={'id'} value={String(data.id ?? '')} variant="outlined" size="small" InputProps={{ readOnly: true }} sx={{ width: '100%' }} />
            )}

            <Autocomplete
              freeSolo={false}
              options={users}
              getOptionLabel={(o) => o?.username || ''}
              value={editing ? ownerValue : (users.find(u => u.id === data.owner_id) || (data.owner ? { id: data.owner_id, username: data.owner } : null))}
              onChange={(e, v) => { if (!editing) return; setOwnerValue(v || null); }}
              disabled={!editing}
              renderInput={(params) => (
                (() => {
                  const ownerDirty = isOwnerDirty;
                  return (
                    <TextField
                      {...params}
                      label={'owner'}
                      variant="outlined"
                      size="small"
                      InputProps={{ ...params.InputProps, readOnly: !editing }}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: ownerDirty ? '#f97316' : undefined },
                          '&:hover fieldset': { borderColor: ownerDirty ? '#f97316' : undefined },
                          boxShadow: ownerDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined,
                        }
                      }}
                    />
                  );
                })()
              )}
            />

            <Box sx={{ p: 1, border: '1px solid', borderColor: '#3b82f6', borderRadius: 1, background: editing ? 'rgba(59,130,246,0.03)' : 'transparent' }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#2563eb' }}>Network</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  label={'IP'}
                  value={editing ? ipValue : String(data.ip ?? '')}
                  variant="outlined"
                  size="small"
                  onChange={(e) => { if (!editing) return; setIpValue(e.target.value); validateIpFields(); }}
                  InputProps={{ readOnly: !editing }}
                  error={Boolean(ipError)} helperText={ipError}
                  sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: isIpDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: isIpDirty ? '#f97316' : undefined }, boxShadow: isIpDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }}
                />
                <TextField
                  label={'Mask'}
                  value={editing ? maskValue : (data.mask ?? '')}
                  variant="outlined"
                  size="small"
                  onChange={(e) => { if (!editing) return; setMaskValue(e.target.value); validateIpFields(); }}
                  InputProps={{ readOnly: !editing }}
                  error={Boolean(maskError)} helperText={maskError}
                  sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: isMaskDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: isMaskDirty ? '#f97316' : undefined }, boxShadow: isMaskDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }}
                />
                <TextField
                  label={'Gateway'}
                  value={editing ? gwValue : (data.gateway ?? '')}
                  variant="outlined"
                  size="small"
                  onChange={(e) => { if (!editing) return; setGwValue(e.target.value); validateIpFields(); }}
                  InputProps={{ readOnly: !editing }}
                  error={Boolean(gwError)} helperText={gwError}
                  sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: isGwDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: isGwDirty ? '#f97316' : undefined }, boxShadow: isGwDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }}
                />
              </Box>
            </Box>
          </Box>

          {/* Right column: name, brand, equip_type, other fields */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField label={'name'} value={editing ? nameValue : String(data.name ?? '')} variant="outlined" size="small" onChange={(e) => { if (!editing) return; setNameValue(e.target.value); if (nameError) setNameError(''); }} InputProps={{ readOnly: !editing }} error={Boolean(nameError)} helperText={nameError} sx={{ width: '100%' }} />

            {/* description (editable) - from T_Equipment.description */}
            <TextField
              label={'description'}
              value={editing ? descriptionValue : String(data.description ?? '')}
              variant="outlined"
              size="small"
              onChange={(e) => { if (!editing) return; setDescriptionValue(e.target.value); }}
              InputProps={{ readOnly: !editing }}
              sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: isDescriptionDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: isDescriptionDirty ? '#f97316' : undefined }, boxShadow: isDescriptionDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }}
            />

            <Autocomplete
              freeSolo={false}
              options={brands}
              getOptionLabel={(o) => o?.name || ''}
              value={editing ? brandValue : (brands.find(b => b.id === data.brand_id) || (data.brand_name ? { id: data.brand_id, name: data.brand_name } : null))}
              onChange={(e, v) => { if (!editing) return; setBrandValue(v || null); }}
              disabled={!editing}
              renderInput={(params) => (
                (() => {
                  const brandDirty = isBrandDirty;
                  return (
                    <TextField {...params} label={'brand'} variant="outlined" size="small" InputProps={{ ...params.InputProps, readOnly: !editing }} sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: brandDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: brandDirty ? '#f97316' : undefined }, boxShadow: brandDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }} />
                  );
                })()
              )}
            />

                <Autocomplete
              freeSolo={false}
              options={equipTypes}
              getOptionLabel={(o) => o?.name || ''}
              value={editing ? equipTypeValue : (equipTypes.find(t => t.id === data.equip_type_id) || (data.equip_type ? { id: data.equip_type_id, name: data.equip_type } : null))}
              onChange={(e, v) => { if (!editing) return; setEquipTypeValue(v || null); }}
              disabled={!editing}
              renderInput={(params) => (
                (() => {
                  const etDirty = isEquipTypeDirty;
                  return (
                    <TextField {...params} label={'equip_type'} variant="outlined" size="small" InputProps={{ ...params.InputProps, readOnly: !editing }} sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: etDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: etDirty ? '#f97316' : undefined }, boxShadow: etDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }} />
                  );
                })()
              )}
            />

                <Autocomplete
                  freeSolo={false}
                  options={libs}
                  getOptionLabel={(o) => o?.name || ''}
                  value={editing ? libValue : (libs.find(l => l.id === data.lib_id) || (data.lib_name ? { id: data.lib_id, name: data.lib_name } : null))}
                  onChange={(e, v) => { if (!editing) return; setLibValue(v || null); }}
                  disabled={!editing}
                  renderInput={(params) => (
                    (() => {
                      const libDirty = isLibDirty;
                      return (
                        <TextField {...params} label={'Lib Version'} variant="outlined" size="small" InputProps={{ ...params.InputProps, readOnly: !editing }} sx={{ width: '100%', '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: libDirty ? '#f97316' : undefined }, '&:hover fieldset': { borderColor: libDirty ? '#f97316' : undefined }, boxShadow: libDirty ? '0 0 0 6px rgba(249,115,22,0.06)' : undefined } }} />
                      );
                    })()
                  )}
                />


            {Object.keys(data)
              .filter(k => !['id','name','brand_name','brand_id','owner','owner_id','equip_type','equip_type_id','ip','mask','gateway','net_in_use','inUse','nm','gw','description','lib_id','lib_name','credential_port','credential_user','credential_secret','credentials'].includes(k))
              .map((k) => (
                <TextField key={k} label={k} value={String(data[k] ?? '')} variant="outlined" size="small" InputProps={{ readOnly: true }} sx={{ width: '100%' }} />
              ))}
          </Box>
        </Box>

        {/* New framed section titled 'XXXX' inserted below the main form */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ p: 1, border: '1px solid', borderColor: '#374151', borderRadius: 1, background: 'transparent' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ display: 'block', color: '#111827' }}>XXXX</Typography>
              <Button size="small" variant="outlined" onClick={() => setAddingNew(true)} disabled={addingNew}>Add credential</Button>
            </Box>
            <Box sx={{ minHeight: 40, display: 'flex', gap: 2, alignItems: 'stretch', flexDirection: 'row', overflowX: 'auto', px: 0.5 }}>
              <TableContainer sx={{ flex: '1 1 auto', maxHeight: credentialsMaxHeight, overflowY: _shouldCredentialScroll ? 'auto' : 'visible' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Secret</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Port</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {addingNew ? (
                      <TableRow>
                        <TableCell>
                          <Autocomplete
                            options={credentialTypes}
                            getOptionLabel={(o) => o?.name || ''}
                            value={credentialTypes.find(t => t.id === newCredValues.type_id) || null}
                            onChange={(e, v) => setNewCredValues((s) => ({ ...s, type_id: v ? v.id : '' }))}
                            renderInput={(params) => <TextField {...params} label="Type" size="small" />}
                            sx={{ width: 180 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={newCredValues.usr} onChange={(e) => setNewCredValues((s) => ({ ...s, usr: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type={'text'} value={newCredValues.pwd} onChange={(e) => setNewCredValues((s) => ({ ...s, pwd: e.target.value }))} sx={{ width: '100%' }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={newCredValues.port} onChange={(e) => setNewCredValues((s) => ({ ...s, port: e.target.value }))} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton size="small" color="primary" disabled={!isNewCredValid} onClick={async () => {
                              if (!isNewCredValid) return;
                              const benchId = data?.id || params?.id;
                              try {
                                const payload = { type_id: Number(newCredValues.type_id), usr: newCredValues.usr || null, port: newCredValues.port || null, pwd: newCredValues.pwd || null };
                                const res = await createCredential(benchId, payload);
                                setData((d) => ({ ...d, credentials: [ ...(Array.isArray(d.credentials) ? d.credentials : []), res ] }));
                                setAddingNew(false);
                                setNewCredValues({ type_id: '', usr: '', port: '', pwd: '' });
                                showToast('Credential created', { type: 'success' });
                              } catch (e) {
                                console.error('Could not create credential', e);
                                showToast('Could not create credential: ' + (e.response?.data?.detail || e.message), { type: 'error' });
                              }
                            }} title="Save"><SaveIcon fontSize="small" /></IconButton>
                            <IconButton size="small" onClick={() => { setAddingNew(false); setNewCredValues({ type_id: '', usr: '', port: '', pwd: '' }); }} title="Cancel"><CloseIcon fontSize="small" /></IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {(() => {
                      const creds = Array.isArray(data.credentials) ? data.credentials : [];
                      if (!creds.length) {
                        return (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ textAlign: 'center', color: '#6b7280' }}>No credentials available</TableCell>
                          </TableRow>
                        );
                      }
                      return creds.map((c) => {
                        const isEditing = editingCredId === c.cred_id;
                        return (
                        <TableRow key={c.cred_id || c.type_id || c.type}>
                          <TableCell>{c?.type || ''}</TableCell>
                          <TableCell sx={{ width: 180 }}>
                            {isEditing ? (
                              <TextField size="small" value={editValues.usr} onChange={(e) => setEditValues((v) => ({ ...v, usr: e.target.value }))} />
                            ) : (
                              c?.usr || ''
                            )}
                          </TableCell>
                          <TableCell sx={{ width: 220 }}>
                            {isEditing ? (
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField size="small" type={showEditPwd ? 'text' : 'password'} value={editValues.pwd} onChange={(e) => setEditValues((v) => ({ ...v, pwd: e.target.value }))} sx={{ flex: 1 }} />
                                <IconButton size="small" onClick={() => setShowEditPwd(s => !s)} sx={{ p: '6px' }}>{showEditPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, border: '1px solid #e5e7eb', borderRadius: 1, px: 1, py: 0.5 }}>
                                <Box sx={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#111827' }}>{revealedSecrets[c.cred_id] ?? maskSecret(c?.pwd)}</Box>
                                <IconButton size="small" onClick={() => handleReveal(c.cred_id)} sx={{ p: '2px' }}>
                                  {revealedSecrets[c.cred_id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                </IconButton>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ width: 140 }}>
                            {isEditing ? (
                              <TextField size="small" value={editValues.port} onChange={(e) => setEditValues((v) => ({ ...v, port: e.target.value }))} />
                            ) : (
                              c?.port ?? ''
                            )}
                          </TableCell>
                          <TableCell sx={{ width: 120 }}>
                            {isEditing ? (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton size="small" color="primary" onClick={() => saveEditCred(c)} title="Save"><SaveIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={() => cancelEditCred()} title="Cancel"><CloseIcon fontSize="small" /></IconButton>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton size="small" onClick={() => startEditCred(c)} title="Edit credential"><EditIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={() => handleDeleteCred(c)} title="Delete credential"><DeleteIcon fontSize="small" /></IconButton>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
              
            </Box>
          </Box>
        </Box>
      </Paper>
      <ConfirmDialog
        open={deleteDialogOpen}
        title={'Delete credential'}
        contentText={'Are you sure you want to delete this credential? This action cannot be undone.'}
        onCancel={cancelDeleteCred}
        onConfirm={confirmDeleteCred}
        confirmText={'Delete'}
        cancelText={'Cancel'}
        confirmColor={'error'}
      >
        {toDeleteCred ? (
          <Box sx={{ mt: 1 }}>
            <div>Type: {toDeleteCred.type || ''}</div>
            <div>User: {toDeleteCred.usr || ''}</div>
          </Box>
        ) : null}
      </ConfirmDialog>

    </Box>
  );
}
