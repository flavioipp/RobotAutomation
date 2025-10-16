import React, { useState } from 'react';
import { login, setAuthToken } from './api';
import { APP_NAME } from './constants';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import './Login.css';

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
    <div className="login-root">
      <Card className="login-card" elevation={8}>
        <CardContent>
          <div className="login-head">
            <div className="logo">{APP_NAME.split(' ').map(s=>s[0]).join('')}</div>
            <div className="title-block">
              <h2>{APP_NAME} Environment</h2>
              <div className="subtitle">Sign in to continue</div>
            </div>
          </div>

          {error && <Alert severity="error" className="login-alert">{error}</Alert>}

          <form onSubmit={handleSubmit} className="login-form">
            <TextField label="Username or email" value={username} onChange={e => setUsername(e.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth />

            <div className="login-actions">
              <FormControlLabel control={<Checkbox checked={false} />} label="Remember me" />
              <a className="link" href="#">Forgot password?</a>
            </div>

            <Button variant="contained" type="submit" color="primary" size="large" fullWidth disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
