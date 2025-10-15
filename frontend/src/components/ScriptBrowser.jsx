import React, { useEffect, useState } from 'react';
import { useToast } from './ToastContext';
import './ScriptBrowser.css';
import { fsGetRepos, fsList, fsGetFile, fsGetMetaDir, fsSaveSuite } from '../api';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export default function ScriptBrowser(props = {}) {
  // Destructure props so hooks can reference explicit dependencies
  const { repos: propsRepos, selectedRepo: propsSelectedRepo, filterText: propsFilterText, cartVisible: propsCartVisible, setRepos: parentSetRepos, setSelectedRepo: parentSetSelectedRepo, setCartCount: parentSetCartCount } = props;
  const [, setRepos] = useState(propsRepos || []);
  const [selectedRepo, setSelectedRepo] = useState(propsSelectedRepo || null);
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState([]);
  const [filterText, setFilterText] = useState(propsFilterText || '');
  const [metadata, setMetadata] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]); // list of relative paths added to the suite
  const [suiteName, setSuiteName] = useState('my_suite');
  // if parent controls cart visibility, use that as source of truth
  const [cartVisible, setCartVisible] = useState(props.cartVisible || false);
  const [dragOver, setDragOver] = useState(false);
  const { showToast } = useToast();
  // badge animation state removed (was unused)
  
  useEffect(() => {
    async function loadRepos() {
      try {
        const r = await fsGetRepos();
        // update local state
        setRepos(r);
  // if parent provided a setter, update it too so AppBar can show repos
  if (parentSetRepos) try { parentSetRepos(r); } catch (e) {}
  // prefill selected repo from localStorage if available and valid
        try {
          const last = localStorage.getItem('last_repo');
            if (last && r.includes(last)) {
            setSelectedRepo(last);
            if (parentSetSelectedRepo) try { parentSetSelectedRepo(last); } catch (e) {}
            setPath('.');
            setSelectedFile(null);
            setPreviewFile(null);
          }
        } catch (err) {
          // ignore localStorage errors
        }
      } catch (e) {
        console.error('Could not load repos', e);
        showToast('Could not load repositories', { type: 'error' });
      }
    }
    loadRepos();
  }, [showToast, parentSetRepos, parentSetSelectedRepo]);

  // sync incoming props to local state when parent controls them
  useEffect(() => { if (propsRepos) setRepos(propsRepos); }, [propsRepos]);
  useEffect(() => { if (propsSelectedRepo !== undefined) setSelectedRepo(propsSelectedRepo); }, [propsSelectedRepo]);
  useEffect(() => { if (propsFilterText !== undefined) setFilterText(propsFilterText); }, [propsFilterText]);
  useEffect(() => { if (propsCartVisible !== undefined) setCartVisible(propsCartVisible); }, [propsCartVisible]);

  useEffect(() => {
    async function loadEntries() {
      if (!selectedRepo) return;
      setLoading(true);
      try {
        const list = await fsList(selectedRepo, path || '.');
    // backend now filters hidden files/directories (any path segment starting with '.')
    // hide the 'suites' directory from the main browser view (we manage suites in a dedicated page)
  const filtered = list.filter(ent => !(ent.is_dir && ent.name === 'suites'));
  setEntries(filtered);
        // fetch metadata for all files in the directory using batch endpoint
        try {
          const metaMap = await fsGetMetaDir(selectedRepo, path || '.');
          setMetadata(metaMap || {});
        } catch (err) {
          setMetadata({});
        }
        // saved suites are handled on the dedicated Saved Suites page
      } catch (e) {
        console.error('Could not list path', e);
        showToast('Could not list directory', { type: 'error' });
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, [selectedRepo, path, showToast]);

  useEffect(() => {
    async function loadFile() {
      if (!previewFile || !selectedRepo) return;
      setLoading(true);
      try {
        const data = await fsGetFile(selectedRepo, previewFile);
        setFileContent(data.content || '');
      } catch (e) {
        console.error('Could not load file', e);
        showToast('Could not load file', { type: 'error' });
        setFileContent('Could not load file');
      } finally {
        setLoading(false);
      }
    }
    loadFile();
  }, [previewFile, selectedRepo, showToast]);

  const enterDir = (entry) => {
    if (!entry.is_dir) return;
    setPath(entry.path);
    setSelectedFile(null);
    setPreviewFile(null);
  };

  const upOne = () => {
    if (!path || path === '.' || path === '') return;
    const parts = path.split('/');
    parts.pop();
    const np = parts.length ? parts.join('/') : '.';
    setPath(np);
    setSelectedFile(null);
    setPreviewFile(null);
  };

  const breadcrumb = () => {
    const parts = (path === '.' || !path) ? [] : path.split('/');
    const items = [{ name: selectedRepo, path: '.' }, ...parts.map((p, i) => ({ name: p, path: parts.slice(0, i+1).join('/') }))];
    return items;
  };

  // determine grid layout class based on visibility of preview and cart
  const gridClass = previewFile ? (cartVisible ? 'preview-and-cart' : 'preview-only') : (cartVisible ? 'cart-only' : 'no-preview');

  // badge animation removed (was unused)

  // propagate cart count to parent if requested
  useEffect(() => {
    if (parentSetCartCount) {
      try { parentSetCartCount(cart.length); } catch (e) {}
    }
  }, [cart.length]);

  return (
    <div className="script-browser-root" style={{ padding: 24 }}>
      {/*<div className="repo-top">
        <h3 style={{ margin: 0 }}>{selectedRepo || ''}</h3>
      </div>*/}

  <div className={`bottom-grid ${gridClass}`}>
        <section className="browser-main">
          <div className="browser-header">
            <div>
              {/* <h3 style={{ margin: 0 }}>{selectedRepo ? 'Script Browser' : ''}</h3> */}
              <div className="subtle">{loading ? 'Loading...' : path}</div>
            </div>
            <div className="browser-actions">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="icon-btn" onClick={upOne} disabled={!selectedRepo} title="Up"><ArrowUpwardIcon fontSize="small"/></button>
              </div>
            </div>
          </div>

          <div className="breadcrumb">
            {selectedRepo && breadcrumb().map((b, i) => (
              <button key={i} className="crumb" onClick={() => { setPath(b.path === '.' ? '.' : b.path); setSelectedFile(null); setPreviewFile(null); }}>{b.name}</button>
            ))}
          </div>

          <div style={{ marginTop: 12 }} className="entries">
            <ul>
              {entries.filter(e => {
                if (!filterText || filterText.trim() === '') return true;
                const q = filterText.toLowerCase();
                const nameMatch = e.name && e.name.toLowerCase().includes(q);
                const pathMatch = e.path && e.path.toLowerCase().includes(q);
                const meta = metadata && metadata[e.path];
                const topologyMatch = meta && meta.topology && String(meta.topology).toLowerCase().includes(q);
                const authorMatch = meta && meta.author && String(meta.author).toLowerCase().includes(q);
                return nameMatch || pathMatch || topologyMatch || authorMatch;
              }).map(e => (
                <li key={e.path} draggable={!e.is_dir} onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', e.path); }} className={`entry ${e.is_dir ? 'dir' : 'file'} ${e.path === selectedFile ? 'active' : ''}`} onDoubleClick={() => { if (e.is_dir) enterDir(e); else { setSelectedFile(e.path); setPreviewFile(null); } }}>
                  <div className="entry-left">
                    {e.is_dir ? <FolderIcon fontSize="small"/> : <InsertDriveFileIcon fontSize="small"/>}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button className="entry-name" onClick={() => { if (e.is_dir) enterDir(e); else { setSelectedFile(e.path); setPreviewFile(null); } }}>{e.name}</button>
                      {!e.is_dir && metadata && metadata[e.path] && (
                        <div className="file-meta">
                          {metadata[e.path].explicit_fields && metadata[e.path].explicit_fields.description && metadata[e.path].description && (
                            <div className="meta-desc">{metadata[e.path].description}</div>
                          )}
                          <div className="meta-attrs">
                            {metadata[e.path].explicit_fields && metadata[e.path].explicit_fields.topology && metadata[e.path].topology && (
                              <span className="meta-item">Topology: {metadata[e.path].topology}</span>
                            )}
                            {metadata[e.path].explicit_fields && metadata[e.path].explicit_fields.author && metadata[e.path].author && (
                              <span className="meta-item">Author: {metadata[e.path].author}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="entry-actions">
                    {!e.is_dir && (
                      <>
              <button className="icon-btn" title="Open in preview" onClick={() => { setPreviewFile(e.path); setSelectedFile(e.path); }}><OpenInNewIcon fontSize="small"/></button>
              <button className="icon-btn" title="Add to suite" onClick={() => { if (!cart.includes(e.path)) { setCart([...cart, e.path]); setCartVisible(true); } }} style={{ marginLeft: 8 }}>+</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
        {previewFile && (
          <aside className="preview-pane">
            <h3>Preview</h3>
            <div className="preview-box">
              {metadata && metadata[previewFile] && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>{previewFile}</strong>
                    {metadata[previewFile].explicit_fields && metadata[previewFile].explicit_fields.topology && (
                      <span className="meta-item">Topology: {metadata[previewFile].topology}</span>
                    )}
                    {metadata[previewFile].explicit_fields && metadata[previewFile].explicit_fields.author && (
                      <span className="meta-item">Author: {metadata[previewFile].author}</span>
                    )}
                  </div>
                  {metadata[previewFile].explicit_fields && metadata[previewFile].explicit_fields.description && metadata[previewFile].description && (
                    <div style={{ marginTop: 8, color: '#dbeafe' }}>{metadata[previewFile].description}</div>
                  )}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', marginTop: 8 }}>{fileContent}</div>
            </div>
          </aside>
        )}

        {cartVisible && (
          <aside className="cart-pane">
          <h3>Suite Cart</h3>
          <div className={`cart-body`}>
            <div className={`cart-dropzone ${dragOver ? 'drag-over' : ''}`} onDragOver={(ev) => { ev.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(ev) => { ev.preventDefault(); setDragOver(false); const p = ev.dataTransfer.getData('text/plain'); if (p && !cart.includes(p)) { setCart([...cart, p]); setCartVisible(true); } }}>
              <div style={{ padding: 8 }}>Drag files here or click + on a file to add</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>Suite name:</label>
              <input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 6 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <ul className="cart-list">
                {cart.map((p, idx) => (
                  <li key={p} className="cart-item">
                    <span style={{ flex: 1 }} title={p}>{p.split('/').pop()}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="icon-btn" title="Up" onClick={() => { if (idx === 0) return; const c = [...cart]; [c[idx-1], c[idx]] = [c[idx], c[idx-1]]; setCart(c); }}>▲</button>
                      <button className="icon-btn" title="Down" onClick={() => { if (idx === cart.length-1) return; const c = [...cart]; [c[idx+1], c[idx]] = [c[idx], c[idx+1]]; setCart(c); }}>▼</button>
                      <button className="icon-btn" title="Remove" onClick={() => { setCart(cart.filter(x => x !== p)); }}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="cart-footer">
            <div style={{ display: 'flex', gap: 8 }}>
              <button aria-label="Save Suite" title="Save Suite" onClick={async () => {
                if (!selectedRepo) return showToast('Select a repo first', { type: 'error' });
                if (!suiteName) return showToast('Suite name required', { type: 'error' });
                if (!cart.length) return showToast('No files in suite', { type: 'error' });
                try {
                  setLoading(true);
                  const res = await fsSaveSuite(selectedRepo, suiteName, cart);
                  showToast('Suite saved: ' + res.path, { type: 'success' });
                } catch (err) {
                  console.error(err);
                  showToast('Could not save suite: ' + (err.response?.data?.detail || err.message), { type: 'error' });
                } finally { setLoading(false); }
              }} disabled={loading} className="save-btn"><span className="save-label">Save Suite</span></button>
              <button onClick={() => { setCart([]); }} className="clear-btn">Clear</button>
            </div>
          </div>

          {/* Saved suites moved to dedicated page */}
        </aside>
        )}
      </div>
      {/* suite viewing moved to Saved Suites page */}
    </div>
  );
}
