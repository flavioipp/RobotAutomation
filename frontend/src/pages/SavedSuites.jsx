import React, { useEffect, useState } from 'react';
import { fsListSuites, fsGetSuiteFile, fsGetConfig } from '../api';
import { useToast } from '../components/ToastContext';
import './SavedSuites.css';

export default function SavedSuites() {
  const [repo, setRepo] = useState('');
  const [suites, setSuites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // load configured repo from backend; if not configured, show a message
    (async () => {
      setLoading(true);
      try {
        const cfg = await fsGetConfig();
        if (cfg && cfg.script_repo_name) {
          setRepo(cfg.script_repo_name);
          const s = await fsListSuites(cfg.script_repo_name);
          setSuites(s || []);
        } else {
          setRepo('');
          setSuites([]);
        }
      } catch (err) {
        console.warn('Could not fetch config or list suites', err);
      } finally { setLoading(false); }
    })();
  }, []);

  const loadSuites = async () => {
    if (!repo) return showToast('Repository not configured on the backend. Please set SCRIPT_REPO_NAME in .env', { type: 'error' });
    setLoading(true);
    try {
      const s = await fsListSuites(repo);
      setSuites(s || []);
    } catch (e) {
      console.error(e);
      showToast('Could not list suites: ' + (e.response?.data?.detail || e.message), { type: 'error' });
    } finally { setLoading(false); }
  };

  const viewRobot = async (name) => {
    try {
      const r = await fsGetSuiteFile(repo, name);
      setModalContent(r.content || '');
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      showToast('Could not fetch robot file: ' + (e.response?.data?.detail || e.message), { type: 'error' });
    }
  };

  return (
    <div style={{ padding: 24 }} className="saved-suites-root">
      <h2>Saved Suites</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        {repo ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ padding: 8, minWidth: 320, background: '#111827', color: '#fff', borderRadius: 4 }}>{repo}</div>
            <button onClick={loadSuites}>Reload</button>
          </div>
        ) : (
          <div style={{ color: '#9ca3af' }}>No repository configured. Please set <code>SCRIPT_REPO_NAME</code> in the backend .env.</div>
        )}
      </div>

      {loading && <div>Loading...</div>}

      <div>
        {suites.length === 0 && <div className="subtle">No suites</div>}
        <ul>
          {suites.map(s => (
            <li key={s.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ flex: 1 }}>{s.name}</strong>
              <button onClick={() => viewRobot(s.name)}>View</button>
              <a href={`http://127.0.0.1:8000/git/fs/suite-file?repo=${encodeURIComponent(repo)}&name=${encodeURIComponent(s.name)}`} target="_blank" rel="noreferrer">Download</a>
            </li>
          ))}
        </ul>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Robot Suite</div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">{modalContent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
