import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { toast } from 'react-toastify';

import api from '../../services/api';

interface Template {
  id: string;
  name: string;
  clicksign_template_key: string;
  description: string | null;
}

interface ClickSignInfo {
  has_token: boolean;
  api_token_masked: string | null;
  base_url: string | null;
}

const C = {
  border: '#e8eef2',
  textMuted: '#64748b',
  surface: '#ffffff',
};

export default function ClickSignSection({
  enterpriseId,
  canEdit,
}: {
  enterpriseId: string;
  canEdit: boolean;
}) {
  const [info, setInfo] = useState<ClickSignInfo | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  // Token editor
  const [tokenDraft, setTokenDraft] = useState('');
  const [baseUrlDraft, setBaseUrlDraft] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  // Template dialog (create/edit)
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgSaving, setDlgSaving] = useState(false);
  const [dlgTarget, setDlgTarget] = useState<Template | null>(null);
  const [dlgName, setDlgName] = useState('');
  const [dlgKey, setDlgKey] = useState('');
  const [dlgDesc, setDlgDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, tplRes] = await Promise.all([
        api.get<ClickSignInfo>(`/enterprise/${enterpriseId}/clicksign`),
        api.get<Template[]>(
          `/enterprise/${enterpriseId}/contract-templates`,
        ),
      ]);
      setInfo(infoRes.data);
      setTemplates(tplRes.data ?? []);
      setBaseUrlDraft(infoRes.data.base_url || '');
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao carregar configuração do ClickSign.',
      );
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveToken = async () => {
    setSavingToken(true);
    try {
      const body: Record<string, string | null> = {};
      // Só manda api_token se o admin digitou alguma coisa — assim
      // o "salvar" só pra ajustar base_url não zera o token.
      if (editingToken) body.api_token = tokenDraft.trim() || null;
      body.base_url = baseUrlDraft.trim() || null;
      await api.patch(`/enterprise/${enterpriseId}/clicksign`, body);
      toast.success('Configuração salva.');
      setEditingToken(false);
      setTokenDraft('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSavingToken(false);
    }
  };

  const openCreate = () => {
    setDlgTarget(null);
    setDlgName('');
    setDlgKey('');
    setDlgDesc('');
    setDlgOpen(true);
  };

  const openEdit = (t: Template) => {
    setDlgTarget(t);
    setDlgName(t.name);
    setDlgKey(t.clicksign_template_key);
    setDlgDesc(t.description || '');
    setDlgOpen(true);
  };

  const saveDialog = async () => {
    if (!dlgName.trim() || !dlgKey.trim()) {
      toast.warning('Nome e chave são obrigatórios.');
      return;
    }
    setDlgSaving(true);
    try {
      const body = {
        name: dlgName.trim(),
        clicksign_template_key: dlgKey.trim(),
        description: dlgDesc.trim() || null,
      };
      if (dlgTarget) {
        await api.put(
          `/enterprise/${enterpriseId}/contract-templates/${dlgTarget.id}`,
          body,
        );
        toast.success('Modelo atualizado.');
      } else {
        await api.post(
          `/enterprise/${enterpriseId}/contract-templates`,
          body,
        );
        toast.success('Modelo cadastrado.');
      }
      setDlgOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar modelo.');
    } finally {
      setDlgSaving(false);
    }
  };

  const remove = async (t: Template) => {
    if (
      !window.confirm(
        `Remover modelo "${t.name}"? Contratos já emitidos não são afetados.`,
      )
    )
      return;
    try {
      await api.delete(
        `/enterprise/${enterpriseId}/contract-templates/${t.id}`,
      );
      toast.success('Modelo removido.');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover.');
    }
  };

  return (
    <Paper
      sx={{ p: 2, mb: 2, border: `1px solid ${C.border}`, bgcolor: C.surface }}
      elevation={0}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box>
          <Typography fontWeight={700} fontSize={14}>
            Contratos (ClickSign)
          </Typography>
          <Typography fontSize={11} color={C.textMuted}>
            Token da conta e modelos de contrato disponíveis pra emitir após
            aprovar um credenciamento.
          </Typography>
        </Box>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <Stack gap={2}>
          {/* ── Token ─────────────────────────────────────────── */}
          <Box>
            <Typography fontSize={12} fontWeight={600} mb={0.5}>
              Token da API
            </Typography>
            {info?.has_token && !editingToken ? (
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography
                  fontSize={13}
                  fontFamily="monospace"
                  color="text.secondary"
                >
                  {info.api_token_masked}
                </Typography>
                {canEdit && (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingToken(true);
                      setTokenDraft('');
                    }}
                  >
                    Alterar
                  </Button>
                )}
              </Stack>
            ) : (
              <Stack gap={1}>
                <TextField
                  size="small"
                  fullWidth
                  type="password"
                  placeholder="Cole aqui o token da conta ClickSign"
                  value={tokenDraft}
                  onChange={e => setTokenDraft(e.target.value)}
                  disabled={!canEdit || savingToken}
                />
                {!info?.has_token && (
                  <Typography fontSize={11} color={C.textMuted}>
                    Sem token configurado — sem ele, o botão "Gerar contrato"
                    fica bloqueado no credenciamento.
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          {/* ── Base URL ──────────────────────────────────────── */}
          <TextField
            size="small"
            fullWidth
            label="Ambiente ClickSign (opcional)"
            placeholder="https://app.clicksign.com (prod) ou vazio pra sandbox"
            value={baseUrlDraft}
            onChange={e => setBaseUrlDraft(e.target.value)}
            disabled={!canEdit || savingToken}
            helperText="Deixe em branco pra usar o sandbox (padrão)."
          />

          {canEdit && (editingToken || baseUrlDraft !== (info?.base_url || '')) && (
            <Stack direction="row" gap={1}>
              <Button
                variant="contained"
                onClick={saveToken}
                disabled={savingToken}
              >
                {savingToken ? 'Salvando…' : 'Salvar configuração'}
              </Button>
              {editingToken && (
                <Button
                  onClick={() => {
                    setEditingToken(false);
                    setTokenDraft('');
                    setBaseUrlDraft(info?.base_url || '');
                  }}
                  disabled={savingToken}
                >
                  Cancelar
                </Button>
              )}
            </Stack>
          )}

          {/* ── Templates ─────────────────────────────────────── */}
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={1}
            >
              <Typography fontSize={12} fontWeight={600}>
                Modelos de contrato
              </Typography>
              {canEdit && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={openCreate}
                >
                  Adicionar modelo
                </Button>
              )}
            </Stack>

            {templates.length === 0 ? (
              <Alert severity="info">
                Nenhum modelo cadastrado. Cadastre pelo menos um pra poder
                emitir contratos.
              </Alert>
            ) : (
              <Stack gap={1}>
                {templates.map(t => (
                  <Paper
                    key={t.id}
                    variant="outlined"
                    sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}
                  >
                    <Box flex={1} minWidth={0}>
                      <Typography fontSize={13} fontWeight={600} noWrap>
                        {t.name}
                      </Typography>
                      <Typography
                        fontSize={11}
                        color={C.textMuted}
                        fontFamily="monospace"
                        noWrap
                      >
                        {t.clicksign_template_key}
                      </Typography>
                      {t.description && (
                        <Typography fontSize={11} color={C.textMuted} noWrap>
                          {t.description}
                        </Typography>
                      )}
                    </Box>
                    {canEdit && (
                      <>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(t)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => remove(t)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}

      {/* Dialog de criar/editar modelo */}
      <Dialog
        open={dlgOpen}
        onClose={() => !dlgSaving && setDlgOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dlgTarget ? 'Editar modelo' : 'Novo modelo de contrato'}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              size="small"
              fullWidth
              label="Nome amigável"
              placeholder="Ex.: Contrato PJ padrão"
              value={dlgName}
              onChange={e => setDlgName(e.target.value)}
              autoFocus
            />
            <TextField
              size="small"
              fullWidth
              label="Chave do modelo no ClickSign"
              placeholder="uuid do template no ClickSign"
              value={dlgKey}
              onChange={e => setDlgKey(e.target.value.trim())}
              helperText="Pega no dashboard do ClickSign em Modelos."
            />
            <TextField
              size="small"
              fullWidth
              label="Descrição (opcional)"
              value={dlgDesc}
              onChange={e => setDlgDesc(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgOpen(false)} disabled={dlgSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveDialog} disabled={dlgSaving}>
            {dlgSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
