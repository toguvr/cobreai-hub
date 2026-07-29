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
  MenuItem,
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

type ContractProvider = 'clicksign' | 'docusign';

interface Template {
  id: string;
  name: string;
  clicksign_template_key: string;
  description: string | null;
  docusign_role_name: string | null;
}

interface ClickSignInfo {
  has_token: boolean;
  api_token_masked: string | null;
  base_url: string | null;
}

interface DocuSignInfo {
  has_token: boolean;
  access_token_masked: string | null;
  account_id: string | null;
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
  const [dsInfo, setDsInfo] = useState<DocuSignInfo | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ContractProvider>('clicksign');
  const [savingProvider, setSavingProvider] = useState(false);

  // ClickSign token editor
  const [tokenDraft, setTokenDraft] = useState('');
  const [baseUrlDraft, setBaseUrlDraft] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  // DocuSign editor
  const [dsAccessDraft, setDsAccessDraft] = useState('');
  const [dsAccountDraft, setDsAccountDraft] = useState('');
  const [dsBaseUrlDraft, setDsBaseUrlDraft] = useState('');
  const [savingDs, setSavingDs] = useState(false);
  const [editingDsToken, setEditingDsToken] = useState(false);

  // Template dialog (create/edit)
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgSaving, setDlgSaving] = useState(false);
  const [dlgTarget, setDlgTarget] = useState<Template | null>(null);
  const [dlgName, setDlgName] = useState('');
  const [dlgKey, setDlgKey] = useState('');
  const [dlgDesc, setDlgDesc] = useState('');
  const [dlgRole, setDlgRole] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, dsRes, tplRes, provRes] = await Promise.all([
        api.get<ClickSignInfo>(`/enterprise/${enterpriseId}/clicksign`),
        api.get<DocuSignInfo>(`/enterprise/${enterpriseId}/docusign`),
        api.get<Template[]>(
          `/enterprise/${enterpriseId}/contract-templates`,
        ),
        api.get<{ provider: ContractProvider }>(
          `/enterprise/${enterpriseId}/contract-provider`,
        ),
      ]);
      setInfo(infoRes.data);
      setDsInfo(dsRes.data);
      setTemplates(tplRes.data ?? []);
      setBaseUrlDraft(infoRes.data.base_url || '');
      setDsAccountDraft(dsRes.data.account_id || '');
      setDsBaseUrlDraft(dsRes.data.base_url || '');
      setProvider(provRes.data.provider || 'clicksign');
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao carregar configuração de contratos.',
      );
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  const changeProvider = async (next: ContractProvider) => {
    setSavingProvider(true);
    try {
      await api.patch(`/enterprise/${enterpriseId}/contract-provider`, {
        provider: next,
      });
      setProvider(next);
      toast.success(
        `Provider ativo: ${next === 'clicksign' ? 'ClickSign' : 'DocuSign'}.`,
      );
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao trocar provider.',
      );
    } finally {
      setSavingProvider(false);
    }
  };

  const saveDocuSign = async () => {
    setSavingDs(true);
    try {
      const body: Record<string, string | null> = {};
      if (editingDsToken) body.access_token = dsAccessDraft.trim() || null;
      body.account_id = dsAccountDraft.trim() || null;
      body.base_url = dsBaseUrlDraft.trim() || null;
      await api.patch(`/enterprise/${enterpriseId}/docusign`, body);
      toast.success('Configuração do DocuSign salva.');
      setEditingDsToken(false);
      setDsAccessDraft('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSavingDs(false);
    }
  };

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
    setDlgRole('');
    setDlgOpen(true);
  };

  const openEdit = (t: Template) => {
    setDlgTarget(t);
    setDlgName(t.name);
    setDlgKey(t.clicksign_template_key);
    setDlgDesc(t.description || '');
    setDlgRole(t.docusign_role_name || '');
    setDlgOpen(true);
  };

  const saveDialog = async () => {
    if (!dlgName.trim() || !dlgKey.trim()) {
      toast.warning('Nome e chave são obrigatórios.');
      return;
    }
    setDlgSaving(true);
    try {
      const body: Record<string, string | null> = {
        name: dlgName.trim(),
        clicksign_template_key: dlgKey.trim(),
        description: dlgDesc.trim() || null,
        docusign_role_name: dlgRole.trim() || null,
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
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        mb={1.5}
      >
        <Box>
          <Typography fontWeight={700} fontSize={14}>
            Contratos
          </Typography>
          <Typography fontSize={11} color={C.textMuted}>
            Escolha o provider de assinatura e cadastre os modelos usados
            após aprovar um credenciamento.
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Provider"
          value={provider}
          onChange={e => changeProvider(e.target.value as ContractProvider)}
          disabled={!canEdit || savingProvider || loading}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="clicksign">ClickSign</MenuItem>
          <MenuItem value="docusign">DocuSign</MenuItem>
        </TextField>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <Stack gap={2}>
          {/* ── ClickSign (só quando provider=clicksign) ────── */}
          {provider === 'clicksign' && (
          <>
          <Box>
            <Typography fontSize={12} fontWeight={600} mb={0.5}>
              Token da API ClickSign
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
          </>
          )}

          {/* ── DocuSign (só quando provider=docusign) ─────── */}
          {provider === 'docusign' && (
          <>
          <Box>
            <Typography fontSize={12} fontWeight={600} mb={0.5}>
              Access Token DocuSign
            </Typography>
            {dsInfo?.has_token && !editingDsToken ? (
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography
                  fontSize={13}
                  fontFamily="monospace"
                  color="text.secondary"
                >
                  {dsInfo.access_token_masked}
                </Typography>
                {canEdit && (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingDsToken(true);
                      setDsAccessDraft('');
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
                  placeholder="Cole aqui o access token OAuth do DocuSign"
                  value={dsAccessDraft}
                  onChange={e => setDsAccessDraft(e.target.value)}
                  disabled={!canEdit || savingDs}
                />
                {!dsInfo?.has_token && (
                  <Typography fontSize={11} color={C.textMuted}>
                    Sem token, o botão "Gerar contrato" fica bloqueado.
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          <TextField
            size="small"
            fullWidth
            label="Account ID"
            placeholder="UUID da conta DocuSign"
            value={dsAccountDraft}
            onChange={e => setDsAccountDraft(e.target.value)}
            disabled={!canEdit || savingDs}
            helperText="Encontre em Admin → API and Keys → API Account ID."
          />

          <TextField
            size="small"
            fullWidth
            label="Ambiente DocuSign"
            placeholder="https://demo.docusign.net (sandbox) ou https://na1.docusign.net (prod)"
            value={dsBaseUrlDraft}
            onChange={e => setDsBaseUrlDraft(e.target.value)}
            disabled={!canEdit || savingDs}
            helperText="Deixe em branco pra usar demo. Prod: na1, eu1, etc."
          />

          {canEdit &&
            (editingDsToken ||
              dsAccountDraft !== (dsInfo?.account_id || '') ||
              dsBaseUrlDraft !== (dsInfo?.base_url || '')) && (
              <Stack direction="row" gap={1}>
                <Button
                  variant="contained"
                  onClick={saveDocuSign}
                  disabled={savingDs}
                >
                  {savingDs ? 'Salvando…' : 'Salvar configuração'}
                </Button>
                {editingDsToken && (
                  <Button
                    onClick={() => {
                      setEditingDsToken(false);
                      setDsAccessDraft('');
                      setDsAccountDraft(dsInfo?.account_id || '');
                      setDsBaseUrlDraft(dsInfo?.base_url || '');
                    }}
                    disabled={savingDs}
                  >
                    Cancelar
                  </Button>
                )}
              </Stack>
            )}
          </>
          )}

          {/* ── Templates (comuns) ────────────────────────────── */}
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
              label={
                provider === 'docusign'
                  ? 'Template ID no DocuSign'
                  : 'Chave do modelo no ClickSign'
              }
              placeholder={
                provider === 'docusign'
                  ? 'templateId do DocuSign'
                  : 'uuid do template no ClickSign'
              }
              value={dlgKey}
              onChange={e => setDlgKey(e.target.value.trim())}
              helperText={
                provider === 'docusign'
                  ? 'Pega no dashboard do DocuSign em Templates.'
                  : 'Pega no dashboard do ClickSign em Modelos.'
              }
            />
            {provider === 'docusign' && (
              <TextField
                size="small"
                fullWidth
                label="Role Name (DocuSign)"
                placeholder="Signer1"
                value={dlgRole}
                onChange={e => setDlgRole(e.target.value)}
                helperText="Deixe em branco pra usar 'Signer1' (padrão)."
              />
            )}
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
