import React, { useEffect, useState } from "react";
import { getScripts, getRepos, getDirs } from "../api";
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
// Collapse not used anymore
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
// Breadcrumbs/Link/Typography removed (not used after vertical tree)
// Table components removed (replaced by file browser list)
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import TextField from '@mui/material/TextField';
import TablePagination from '@mui/material/TablePagination';
// TableSortLabel removed
import { getScriptContent } from '../api';
import './ScriptsTable.css';

export default function ScriptsTable({ onLoadingChange }) {
  const [data, setData] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [dirs, setDirs] = useState([]);
  const [selectedDir, setSelectedDir] = useState("");
  const [expandedDirs, setExpandedDirs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [previewContent, setPreviewContent] = useState('');
  const [previewScript, setPreviewScript] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  

  useEffect(() => {
    async function loadScripts() {
      try {
        setLoading(true);
        // if repo selected, pass it to API; otherwise load all
        const scripts = await getScripts(selectedRepo, selectedDir || null);
        setData(scripts);
      } catch (error) {
        console.error("Error loading scripts:", error);
      }
      setLoading(false);
    }
    loadScripts();
    // we intentionally run this only on mount; other effects handle repo/dir changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // notify parent about loading state changes (if callback provided)
  useEffect(() => {
    if (typeof onLoadingChange === 'function') onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  // load repos on mount
  useEffect(() => {
    async function loadRepos() {
      try {
        const r = await getRepos();
        setRepos(r);
        if (r && r.length) {
          setSelectedRepo(r[0].id);
        }
      } catch (err) {
        console.error("Error loading repos:", err);
      }
    }
    loadRepos();
  }, []);

  // when selectedRepo changes, load dirs and scripts
  useEffect(() => {
    async function afterRepoChange() {
      if (!selectedRepo) return;
      try {
        const d = await getDirs(selectedRepo);
        setDirs(d);
        setSelectedDir(d && d.length ? d[0] : "");
        const scripts = await getScripts(selectedRepo, d && d.length ? d[0] : null);
        setData(scripts);
      } catch (err) {
        console.error("Error after repo change:", err);
      }
    }
    afterRepoChange();
  }, [selectedRepo]);

  // when selectedDir changes, reload scripts
  useEffect(() => {
    async function afterDirChange() {
      try {
        setLoading(true);
        const scripts = await getScripts(selectedRepo, selectedDir || null);
        setData(scripts);
      } catch (err) {
        console.error("Error changing dir:", err);
      }
      setLoading(false);
    }
    afterDirChange();
  }, [selectedDir, selectedRepo]);

  // helper: filtered + sorted data
  const processedData = React.useMemo(() => {
    const localSortBy = { key: 'filename', dir: 'asc' };
    let list = (data || []).slice();
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s => (s.filename || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.topology || '').toLowerCase().includes(q) || (s.author || '').toLowerCase().includes(q));
    }
    const cmp = (a, b) => {
      const ka = (a[localSortBy.key] || '').toString().toLowerCase();
      const kb = (b[localSortBy.key] || '').toString().toLowerCase();
      if (ka < kb) return localSortBy.dir === 'asc' ? -1 : 1;
      if (ka > kb) return localSortBy.dir === 'asc' ? 1 : -1;
      return 0;
    };
    list.sort(cmp);
    return list;
  }, [data, query]);

  // reset page when data set changes
  React.useEffect(() => {
    setPage(0);
  }, [processedData.length, selectedRepo, selectedDir, query]);

  // handleRequestSort removed (not used)

  const openPreview = async (script) => {
    setPreviewScript(script);
    setPreviewContent('');
    try {
      const resp = await getScriptContent(script.id);
      setPreviewContent(resp.content || '');
    } catch (err) {
      setPreviewContent(`Error loading file: ${err}`);
    }
  };

  // closePreview removed (not used)

  // Build a nested tree from the flat `dirs` list (memoized hook at top-level)
  const tree = React.useMemo(() => {
    const t = {};
    (dirs || []).forEach(d => {
      if (!d || d === '.') return;
      const normalized = d.replace(/\\/g, '/');
      const parts = normalized.split('/');
      let node = t;
      let acc = '';
      parts.forEach(p => {
        acc = acc ? `${acc}/${p}` : p;
        if (!node[p]) node[p] = { __path: acc, __children: {} };
        node = node[p].__children;
      });
    });
    return t;
  }, [dirs]);

  // getChildren/onClickFolder/onClickRoot removed (unused with vertical tree)

  // Recursive renderer for vertical directory tree
  const renderTreeNode = (nodeObj, parentPath = '') => {
    return Object.keys(nodeObj).sort().map(name => {
      const path = parentPath ? `${parentPath}/${name}` : name;
      const children = nodeObj[name].__children || {};
      const hasChildren = Object.keys(children).length > 0;
      return (
        <div key={path}>
          <ListItemButton
            onClick={() => { setSelectedDir(path); }}
            selected={selectedDir === path}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FolderOpenIcon fontSize="small" />
            <ListItemText primary={name} />
            {hasChildren && (
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpandedDirs(prev => prev.includes(path) ? prev.filter(x => x !== path) : [...prev, path]); }}>
                {expandedDirs.includes(path) ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            )}
          </ListItemButton>
          {hasChildren && expandedDirs.includes(path) && (
            <div style={{ paddingLeft: 16 }}>
              {renderTreeNode(children, path)}
            </div>
          )}
        </div>
      );
    });
  };

  // file browser uses processedData (see above) for listing files

  return (
    <Card className="scripts-card">
      <CardContent>
        <div className="scripts-header">
          <div className="scripts-header-left">
            <DescriptionIcon color="primary" />
            <h3 className="scripts-title">TestCase browser</h3>
          </div>

          <div className="scripts-refresh">
            {loading ? <CircularProgress size={20} /> : (
              <IconButton size="small" onClick={() => { setSelectedRepo(selectedRepo); /* trigger refresh */ }}>
                <RefreshIcon />
              </IconButton>
            )}
          </div>
        </div>

        <div className="scripts-controls explorer-root" style={{ marginTop: 12 }}>
          <div className="explorer-left">
            <FormControl size="small" fullWidth>
              <InputLabel id="repo-label">Repository</InputLabel>
              <Select labelId="repo-label" value={selectedRepo || ""} label="Repository" onChange={e => setSelectedRepo(Number(e.target.value))}>
                <MenuItem value="">-- all --</MenuItem>
                {repos.map(r => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <div className="dir-box">
              <div className="dir-title">Directories</div>
              <List>
                {renderTreeNode(tree)}
              </List>
            </div>
          </div>

          <div className="explorer-right">
            <div className="files-panel">
              
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Paper className="paper-padding">
                    <div className="files-header">
                      <div className="files-title">Files</div>
                      <div className="files-actions">
                        <TextField size="small" placeholder="Filter files..." value={query} onChange={e => setQuery(e.target.value)} />
                        <Button size="small" onClick={() => { setQuery(''); setSelectedDir(''); }}>Clear</Button>
                      </div>
                    </div>

                    <List>
                      {processedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(s => (
                        <ListItemButton key={s.id} onClick={() => openPreview(s)} className="file-item">
                          <div className="file-item-left">
                            <DescriptionIcon className="list-item-icon" />
                            <div>
                              <div className="file-filename">{s.filename}</div>
                              <div className="file-meta">{s.description ? (s.description.length > 120 ? s.description.slice(0, 120) + '...' : s.description) : '-'}</div>
                            </div>
                          </div>
                          <div className="file-item-right">
                            <div className="file-meta">{s.topology || '-'}</div>
                            <div className="file-meta">{s.author || '-'}</div>
                            
                          </div>
                        </ListItemButton>
                      ))}
                    </List>

                    <div className="pagination-container">
                      <TablePagination
                        component="div"
                        count={processedData.length}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[5,10,25,50]}
                      />
                    </div>
                  </Paper>
                </div>

                <div className="preview-panel">
                  <Paper className="paper-padding">
                    <div className="preview-header">Preview</div>
                    {previewScript ? (
                      <div>
                        <div className="preview-filename">{previewScript.filename}</div>
                        <div className="file-meta" style={{ marginBottom: 8 }}>{previewScript.path}</div>
                        <SyntaxHighlighter language="python" style={materialLight} showLineNumbers wrapLongLines>
                          {previewContent}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <div className="no-preview">Select a file to preview</div>
                    )}
                  </Paper>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      {/* Modal preview removed: preview is shown in the right panel */}
    </Card>
  );
}
