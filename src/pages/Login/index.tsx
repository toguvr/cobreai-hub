import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await signIn({ email, password });
      navigate('/');
    } catch (err: any) {
      // Mensagem propagada do AuthContext (ex: sem userEnterprise) ou erro genérico
      const apiMsg = err?.response?.data?.message;
      const localMsg = typeof err?.message === 'string' && !err?.response
        ? err.message
        : null;
      toast.error(apiMsg || localMsg || 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0f3d29',
      }}
    >
      <Paper
        elevation={0}
        sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 3 }}
      >
        {/* Logo / branding */}
        <Box
          sx={{
            mb: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            component="img"
            src="/cobreai-login.png"
            alt="Cobreai"
            sx={{
              width: '100%',
              maxWidth: 220,
              height: 'auto',
              display: 'block',
            }}
          />
          <Typography variant="body2" color="text.secondary" mt={1.5}>
            Hub de Gestão de Organizações
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
          <TextField
            label="Senha"
            type="password"
            fullWidth
            size="small"
            sx={{ mb: 3 }}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
