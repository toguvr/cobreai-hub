import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { toast } from 'react-toastify';
import { isAxiosError } from 'axios';
import api from '../../services/api';

interface Props {
  enterpriseId: string;
}

interface IntegrationToken {
  id: string;
  description: string | null;
  token: string;
  active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

type Status = 'active' | 'paused' | 'revoked' | 'expired';

const STATUS: Record<
  Status,
  { label: string; color: 'success' | 'default' | 'error' | 'warning' }
> = {
  active: { label: 'Ativa', color: 'success' },
  paused: { label: 'Pausada', color: 'default' },
  revoked: { label: 'Revogada', color: 'error' },
  expired: { label: 'Expirada', color: 'warning' },
};

const statusOf = (item: IntegrationToken): Status => {
  if (item.revoked_at) return 'revoked';
  if (item.expires_at && new Date(item.expires_at).getTime() < Date.now()) {
    return 'expired';
  }
  return item.active ? 'active' : 'paused';
};

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');

const today = () => new Date().toLocaleDateString('en-CA');

const errorMessage = (err: unknown, fallback: string): string =>
  (isAxiosError(err) && err.response?.data?.message) || fallback;

export default function IntegrationTokenSection({ enterpriseId }: Props) {
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<IntegrationToken[]>([]);
  const [description, setDescription] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [created, setCreated] = useState<IntegrationToken | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<IntegrationToken[]>(
        `/integrationToken/byEnterprise/${enterpriseId}`,
      );
      setTokens(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Falha ao carregar as chaves de integração.');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!description.trim()) {
      toast.warning('Informe para quem é a chave.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<IntegrationToken>('/integrationToken', {
        description: description.trim(),
        enterprise_id: enterpriseId,
        active: true,
        ...(expiresOn && {
          expires_at: new Date(`${expiresOn}T23:59:59`).toISOString(),
        }),
      });
      setCreated(res.data);
      setDescription('');
      setExpiresOn('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Falha ao gerar a chave.'));
    } finally {
      setCreating(false);
    }
  };

  const update = async (
    item: IntegrationToken,
    changes: Partial<Pick<IntegrationToken, 'active' | 'revoked_at'>>,
    message: string,
  ) => {
    setActing(item.id);
    try {
      await api.put('/integrationToken', {
        integrationTokenId: item.id,
        ...changes,
      });
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Falha ao atualizar a chave.'));
    } finally {
      setActing(null);
    }
  };

  const revoke = (item: IntegrationToken) => {
    if (
      !window.confirm(
        `Revogar a chave "${item.description ?? ''}"? O sistema que usa essa chave para de funcionar imediatamente, e a revogação não pode ser desfeita aqui.`,
      )
    ) {
      return;
    }
    update(item, { revoked_at: new Date().toISOString() }, 'Chave revogada.');
  };

  const remove = async (item: IntegrationToken) => {
    if (
      !window.confirm(
        `Excluir a chave "${item.description ?? ''}"? Ela deixa de funcionar e sai da lista.`,
      )
    ) {
      return;
    }
    setActing(item.id);
    try {
      await api.delete(`/integrationToken/${item.id}`);
      toast.success('Chave excluída.');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Falha ao excluir a chave.'));
    } finally {
      setActing(null);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Chave copiada.');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

  return (
    <Paper
      sx={{
        p: 3,
        mb: 2,
        border: '1px solid #e8eef2',
        borderRadius: 2,
      }}
      elevation={0}
    >
      <Stack direction="row" gap={1.5} alignItems="center" mb={1}>
        <VpnKeyIcon color="primary" />
        <Typography fontWeight={700}>Chaves de integração (API)</Typography>
      </Stack>
      <Typography fontSize={13} color="#64748b" mb={2}>
        Gere uma chave para um sistema externo (BI, ERP, parceiro) consultar os
        hospitais, médicos e plantões desta empresa pela API de Integração.
        Envie a chave ao responsável pelo sistema por um canal seguro.
      </Typography>

      <Stack direction="row" gap={2} flexWrap="wrap" alignItems="flex-start">
        <TextField
          size="small"
          label="Para quem é a chave"
          placeholder="Ex.: BI da empresa, ERP Parceiro X"
          value={description}
          onChange={e => setDescription(e.target.value)}
          sx={{ flex: 2, minWidth: 260 }}
        />
        <TextField
          size="small"
          label="Expira em (opcional)"
          type="date"
          value={expiresOn}
          onChange={e => setExpiresOn(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: today() },
          }}
          helperText="Vazio: não expira"
          sx={{ flex: 1, minWidth: 180 }}
        />
        <Button
          variant="contained"
          onClick={create}
          disabled={creating}
          startIcon={creating && <CircularProgress size={14} />}
          sx={{ textTransform: 'none', height: 40 }}
        >
          Gerar chave
        </Button>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {loading && tokens.length === 0 && <CircularProgress size={20} />}

      {!loading && tokens.length === 0 && (
        <Typography fontSize={13} color="#64748b">
          Nenhuma chave gerada para esta empresa.
        </Typography>
      )}

      <Stack gap={1.5}>
        {tokens.map(item => {
          const status = statusOf(item);
          const busy = acting === item.id;
          return (
            <Box
              key={item.id}
              sx={{
                p: 1.5,
                border: '1px solid #e8eef2',
                borderRadius: 1.5,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Stack
                direction="row"
                gap={2}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
              >
                <Stack gap={0.5} minWidth={0} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography fontWeight={600} fontSize={14}>
                      {item.description || 'Sem descrição'}
                    </Typography>
                    <Chip
                      size="small"
                      label={STATUS[status].label}
                      color={STATUS[status].color}
                    />
                  </Stack>
                  <Typography
                    fontSize={12}
                    color="#64748b"
                    fontFamily="monospace"
                  >
                    ••••••••{item.token.slice(-6)}
                  </Typography>
                  <Typography fontSize={12} color="#64748b">
                    Criada em {formatDate(item.created_at)} ·{' '}
                    {item.last_used_at
                      ? `Último uso em ${formatDate(item.last_used_at)}`
                      : 'Nunca usada'}
                    {item.expires_at &&
                      ` · Expira em ${formatDate(item.expires_at)}`}
                    {item.revoked_at &&
                      ` · Revogada em ${formatDate(item.revoked_at)}`}
                  </Typography>
                </Stack>

                <Stack direction="row" gap={1}>
                  {status === 'active' && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() =>
                        update(item, { active: false }, 'Chave pausada.')
                      }
                      sx={{ textTransform: 'none' }}
                    >
                      Pausar
                    </Button>
                  )}
                  {status === 'paused' && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() =>
                        update(item, { active: true }, 'Chave reativada.')
                      }
                      sx={{ textTransform: 'none' }}
                    >
                      Reativar
                    </Button>
                  )}
                  {(status === 'active' || status === 'paused') && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      disabled={busy}
                      onClick={() => revoke(item)}
                      sx={{ textTransform: 'none' }}
                    >
                      Revogar
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={busy}
                    onClick={() => remove(item)}
                    sx={{ textTransform: 'none' }}
                  >
                    Excluir
                  </Button>
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Dialog
        open={!!created}
        onClose={() => setCreated(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Chave gerada</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copie a chave agora. Por segurança, ela não é exibida de novo. Se
            perder, gere outra e exclua esta.
          </Alert>
          <TextField
            fullWidth
            value={created?.token ?? ''}
            slotProps={{
              htmlInput: {
                readOnly: true,
                style: { fontFamily: 'monospace', fontSize: 13 },
              },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copiar">
                      <IconButton
                        onClick={() => created && copy(created.token)}
                        edge="end"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography fontSize={13} color="#64748b" mt={2}>
            O sistema externo envia a chave em toda requisição, no header{' '}
            <code>Authorization: Bearer &lt;chave&gt;</code> ou{' '}
            <code>x-api-key: &lt;chave&gt;</code>. Quem tem a chave consegue ler
            os dados dos hospitais desta empresa.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setCreated(null)}
            sx={{ textTransform: 'none' }}
          >
            Já copiei
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
