import React, { useState } from 'react';
import { login, setAuthToken } from './api';
import { APP_NAME } from './constants';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(username, password);
      const token = data.access_token;
      setAuthToken(token);
      try { localStorage.setItem('auth_token', token); } catch (e) {}
      onLogin(token);
    } catch (err) {
      setError(err.response && err.response.data && err.response.data.detail ? err.response.data.detail : String(err));
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
      <Card style={{ width: 420 }}>
        <CardContent>
          <h2 style={{ marginTop: 0 }}>Login</h2>
          <div style={{ marginBottom: 8, color: '#6b7280' }}>Please access to <strong>{APP_NAME}</strong> environment</div>
          {error && <Alert severity="error" style={{ marginBottom: 12 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TextField label="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
              <Button variant="contained" type="submit" disabled={loading}>{loading ? '...':'Login'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
