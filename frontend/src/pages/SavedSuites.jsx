import React, { useEffect, useState } from 'react';
import { fsListSuites, fsGetSuiteFile } from '../api';
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
    // try to pick a default repo from localStorage and load suites
    try {
      const last = localStorage.getItem('last_repo');
      if (last) {
        setRepo(last);
        (async () => {
          setLoading(true);
          try {
            const s = await fsListSuites(last);
            setSuites(s || []);
          } catch (err) {
            console.warn('Could not list suites for repo', err);
            setSuites([]);
          } finally { setLoading(false); }
        })();
      }
    } catch (e) {}
  }, []);

  const loadSuites = async () => {
    if (!repo) return showToast('Enter repository name', { type: 'error' });
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
        <input placeholder="Repository name (e.g. Repotest)" value={repo} onChange={(e) => setRepo(e.target.value)} style={{ padding: 8, width: 320 }} />
        <button onClick={loadSuites}>Load</button>
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
