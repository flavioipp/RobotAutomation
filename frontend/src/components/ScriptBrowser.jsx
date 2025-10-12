import React, { useEffect, useState } from 'react';
import './ScriptBrowser.css';
import { fsGetRepos, fsList, fsGetFile, fsGetMetaDir } from '../api';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export default function ScriptBrowser() {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [path, setPath] = useState('.');
  const [entries, setEntries] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [metadata, setMetadata] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRepos() {
      try {
        const r = await fsGetRepos();
        setRepos(r);
      } catch (e) {
        console.error('Could not load repos', e);
      }
    }
    loadRepos();
  }, []);

  useEffect(() => {
    async function loadEntries() {
      if (!selectedRepo) return;
      setLoading(true);
      try {
        const list = await fsList(selectedRepo, path || '.');
        // backend now filters hidden files/directories (any path segment starting with '.')
        setEntries(list);
        // fetch metadata for all files in the directory using batch endpoint
        try {
          const metaMap = await fsGetMetaDir(selectedRepo, path || '.');
          setMetadata(metaMap || {});
        } catch (err) {
          console.warn('Could not fetch metadata for directory', err);
          setMetadata({});
        }
      } catch (e) {
        console.error('Could not list path', e);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, [selectedRepo, path]);

  useEffect(() => {
    async function loadFile() {
      if (!previewFile || !selectedRepo) return;
      setLoading(true);
      try {
        const data = await fsGetFile(selectedRepo, previewFile);
        setFileContent(data.content || '');
      } catch (e) {
        console.error('Could not load file', e);
        setFileContent('Could not load file');
      } finally {
        setLoading(false);
      }
    }
    loadFile();
  }, [previewFile, selectedRepo]);

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

  return (
    <div className="script-browser-root" style={{ padding: 24 }}>
      <div className="repo-top">
        <h3 style={{ margin: 0 }}>Repositories</h3>
        <div className="repo-list-horizontal">
          {repos.map(r => (
            <button key={r} className={`repo-btn ${r === selectedRepo ? 'selected' : ''}`} onClick={() => { setSelectedRepo(r); setPath('.'); setSelectedFile(null); setPreviewFile(null); }}>{r}</button>
          ))}
        </div>
      </div>

  <div className={`bottom-grid ${!previewFile ? 'no-preview' : ''}`}>
        <section className="browser-main">
          <div className="browser-header">
            <div>
              <h3 style={{ margin: 0 }}>{selectedRepo ? 'TestCase Browser' : 'Select a repository'}</h3>
              <div className="subtle">{loading ? 'Loading...' : path}</div>
            </div>
            <div className="browser-actions">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" placeholder="Filter files..." value={filterText} onChange={(e) => setFilterText(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd' }} />
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
                <li key={e.path} className={`entry ${e.is_dir ? 'dir' : 'file'} ${e.path === selectedFile ? 'active' : ''}`} onDoubleClick={() => { if (e.is_dir) enterDir(e); else { setSelectedFile(e.path); setPreviewFile(null); } }}>
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
                    {!e.is_dir && <button className="icon-btn" title="Open in preview" onClick={() => { setPreviewFile(e.path); setSelectedFile(e.path); }}><OpenInNewIcon fontSize="small"/></button>}
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
      </div>
    </div>
  );
}
