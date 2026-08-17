import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
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
  /** true depois do OAuth completo (refresh_token guardado). */
  connected: boolean;
  /** true quando Integration Key + Secret estão cadastrados. */
  has_credentials: boolean;
  /** Integration Key mascarada — nunca o valor. */
  integration_key_masked: string | null;
  /** Ambiente OAuth cadastrado (demo ou prod). */
  oauth_base_url: string;
  /** Conta DocuSign selecionada (userinfo default). */
  account_id: string | null;
  /** Base URL do datacenter (ex.: https://na4.docusign.net). */
  base_url: string | null;
  /** User ID (sub do OAuth). */
  user_id: string | null;
  /** ISO da próxima expiração do access_token; refresh é automático. */
  access_token_expires_at: string | null;
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

  // DocuSign
  const [connectingDs, setConnectingDs] = useState(false);
  const [disconnectingDs, setDisconnectingDs] = useState(false);
  // Cadastro de credenciais (Integration Key + Secret + ambiente).
  const [dsIntegrationKey, setDsIntegrationKey] = useState('');
  const [dsSecretKey, setDsSecretKey] = useState('');
  const [dsOauthBase, setDsOauthBase] = useState<
    'https://account-d.docusign.com' | 'https://account.docusign.com'
  >('https://account-d.docusign.com');
  const [editingDsCreds, setEditingDsCreds] = useState(false);
  const [savingDsCreds, setSavingDsCreds] = useState(false);

  // Template dialog (create/edit)
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgSaving, setDlgSaving] = useState(false);
  const [dlgTarget, setDlgTarget] = useState<Template | null>(null);
  const [dlgName, setDlgName] = useState('');
  const [dlgKey, setDlgKey] = useState('');
  const [dlgDesc, setDlgDesc] = useState('');
  const [dlgRole, setDlgRole] = useState('');
  // Templates DocuSign carregados via /docusign/templates (só quando
  // o dialog abre pra DocuSign). Se falhar, o campo vira texto livre
  // com aviso — não bloqueia o admin de salvar manualmente.
  const [dsTemplates, setDsTemplates] = useState<
    Array<{
      templateId: string;
      name: string;
      shared: boolean;
      roles: string[];
    }>
  >([]);
  const [dsTemplatesLoading, setDsTemplatesLoading] = useState(false);
  const [dsTemplatesError, setDsTemplatesError] = useState<string | null>(
    null,
  );

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
      setProvider(provRes.data.provider || 'clicksign');
      // Sincroniza o dropdown de ambiente com o que já está salvo.
      const savedBase = dsRes.data.oauth_base_url;
      if (
        savedBase === 'https://account.docusign.com' ||
        savedBase === 'https://account-d.docusign.com'
      ) {
        setDsOauthBase(savedBase);
      }
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

  const saveDsCredentials = async () => {
    if (!dsIntegrationKey.trim() || !dsSecretKey.trim()) {
      toast.warning('Integration Key e Secret são obrigatórios.');
      return;
    }
    setSavingDsCreds(true);
    try {
      await api.patch(
        `/enterprise/${enterpriseId}/docusign/credentials`,
        {
          integration_key: dsIntegrationKey.trim(),
          secret_key: dsSecretKey.trim(),
          oauth_base_url: dsOauthBase,
        },
      );
      toast.success('Credenciais salvas. Agora clique em Conectar DocuSign.');
      setEditingDsCreds(false);
      setDsIntegrationKey('');
      setDsSecretKey('');
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao salvar credenciais.',
      );
    } finally {
      setSavingDsCreds(false);
    }
  };

  const connectDocuSign = async () => {
    setConnectingDs(true);
    try {
      const res = await api.get<{ url: string }>(
        `/enterprise/${enterpriseId}/docusign/authorize`,
      );
      // Navega o browser inteiro pra o DocuSign. Depois de aprovar,
      // o DocuSign redireciona pro callback público do back, que
      // redireciona pra /configuracoes?docusign=connected.
      window.location.href = res.data.url;
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Não foi possível iniciar a conexão com o DocuSign.',
      );
      setConnectingDs(false);
    }
  };

  const disconnectDocuSign = async () => {
    if (
      !window.confirm(
        'Desconectar DocuSign? Novos contratos vão parar de sair até você reconectar.',
      )
    )
      return;
    setDisconnectingDs(true);
    try {
      await api.post(`/enterprise/${enterpriseId}/docusign/disconnect`);
      toast.success('DocuSign desconectado.');
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao desconectar.',
      );
    } finally {
      setDisconnectingDs(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  // Toast de sucesso/erro após o redirect do DocuSign (?docusign=…).
  // Roda uma vez por mount; limpa a query pra não repetir se o
  // admin recarregar a página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('docusign');
    if (!status) return;
    if (status === 'connected') {
      toast.success('DocuSign conectado com sucesso.');
    } else if (status === 'error') {
      const reason = params.get('reason') || 'desconhecido';
      toast.error(`Falha ao conectar DocuSign: ${reason}`);
    }
    params.delete('docusign');
    params.delete('reason');
    const nextSearch = params.toString();
    const url =
      window.location.pathname + (nextSearch ? `?${nextSearch}` : '');
    window.history.replaceState({}, '', url);
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

  const loadDsTemplates = useCallback(async () => {
    if (provider !== 'docusign') return;
    setDsTemplatesLoading(true);
    setDsTemplatesError(null);
    try {
      const res = await api.get<{
        templates: Array<{
          templateId: string;
          name: string;
          shared: boolean;
          roles: string[];
        }>;
      }>(`/enterprise/${enterpriseId}/docusign/templates`);
      setDsTemplates(res.data.templates);
    } catch (e: any) {
      setDsTemplates([]);
      setDsTemplatesError(
        e?.response?.data?.message ||
          'Falha ao listar templates DocuSign. Confira se a conta está conectada.',
      );
    } finally {
      setDsTemplatesLoading(false);
    }
  }, [provider, enterpriseId]);

  const openCreate = () => {
    setDlgTarget(null);
    setDlgName('');
    setDlgKey('');
    setDlgDesc('');
    setDlgRole('');
    setDlgOpen(true);
    loadDsTemplates();
  };

  const openEdit = (t: Template) => {
    setDlgTarget(t);
    setDlgName(t.name);
    setDlgKey(t.clicksign_template_key);
    setDlgDesc(t.description || '');
    setDlgRole(t.docusign_role_name || '');
    setDlgOpen(true);
    loadDsTemplates();
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
              Integration Key (App do DocuSign da sua empresa)
            </Typography>
            {dsInfo?.has_credentials && !editingDsCreds ? (
              <Stack gap={0.5}>
                <Typography fontSize={13} color={C.textMuted}>
                  Cadastrada:{' '}
                  <b style={{ fontFamily: 'monospace' }}>
                    {dsInfo.integration_key_masked}
                  </b>
                </Typography>
                <Typography fontSize={12} color={C.textMuted}>
                  Ambiente:{' '}
                  <b style={{ fontFamily: 'monospace' }}>
                    {dsInfo.oauth_base_url}
                  </b>
                </Typography>
                {canEdit && (
                  <Box mt={0.5}>
                    <Button
                      size="small"
                      onClick={() => {
                        setEditingDsCreds(true);
                        setDsIntegrationKey('');
                        setDsSecretKey('');
                      }}
                    >
                      Alterar credenciais
                    </Button>
                  </Box>
                )}
              </Stack>
            ) : (
              <Stack gap={1}>
                {!dsInfo?.has_credentials && (
                  <Typography fontSize={12} color={C.textMuted}>
                    Cada empresa usa sua própria conta DocuSign. Crie uma
                    Integration Key no console e cole aqui — o Redirect
                    URI a cadastrar lá é{' '}
                    <b style={{ fontFamily: 'monospace' }}>
                      {(import.meta.env.VITE_API_URL || '') +
                        '/docusign/oauth/callback'}
                    </b>
                    .
                  </Typography>
                )}
                <TextField
                  size="small"
                  fullWidth
                  label="Integration Key"
                  placeholder="uuid da Integration Key"
                  value={dsIntegrationKey}
                  onChange={e => setDsIntegrationKey(e.target.value)}
                  disabled={!canEdit || savingDsCreds}
                />
                <TextField
                  size="small"
                  fullWidth
                  type="password"
                  label="Secret Key"
                  placeholder="colar o Secret gerado no console"
                  value={dsSecretKey}
                  onChange={e => setDsSecretKey(e.target.value)}
                  disabled={!canEdit || savingDsCreds}
                />
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Ambiente"
                  value={dsOauthBase}
                  onChange={e =>
                    setDsOauthBase(
                      e.target.value as
                        | 'https://account-d.docusign.com'
                        | 'https://account.docusign.com',
                    )
                  }
                  disabled={!canEdit || savingDsCreds}
                  helperText="Demo enquanto a Integration Key não passou pelo Go-Live."
                >
                  <MenuItem value="https://account-d.docusign.com">
                    Demo / Dev (account-d.docusign.com)
                  </MenuItem>
                  <MenuItem value="https://account.docusign.com">
                    Produção (account.docusign.com)
                  </MenuItem>
                </TextField>
                {canEdit && (
                  <Stack direction="row" gap={1}>
                    <Button
                      variant="contained"
                      onClick={saveDsCredentials}
                      disabled={savingDsCreds}
                    >
                      {savingDsCreds ? 'Salvando…' : 'Salvar credenciais'}
                    </Button>
                    {editingDsCreds && (
                      <Button
                        onClick={() => {
                          setEditingDsCreds(false);
                          setDsIntegrationKey('');
                          setDsSecretKey('');
                        }}
                        disabled={savingDsCreds}
                      >
                        Cancelar
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Box>

          {/* Conexão OAuth — só quando credenciais estão salvas. */}
          {dsInfo?.has_credentials && (
            <Box>
              <Typography fontSize={12} fontWeight={600} mb={0.5}>
                Conexão OAuth
              </Typography>
              {dsInfo.connected ? (
                <Stack gap={1}>
                  <Typography fontSize={13} color="success.main">
                    ● Conectado — o token é renovado automaticamente.
                  </Typography>
                  <Typography fontSize={12} color={C.textMuted}>
                    Conta:{' '}
                    <b style={{ fontFamily: 'monospace' }}>
                      {dsInfo.account_id ?? '?'}
                    </b>
                    {' · '}Datacenter:{' '}
                    <b style={{ fontFamily: 'monospace' }}>
                      {dsInfo.base_url ?? '?'}
                    </b>
                  </Typography>
                  {canEdit && (
                    <Stack direction="row" gap={1} mt={0.5}>
                      <Button
                        size="small"
                        onClick={connectDocuSign}
                        disabled={connectingDs || disconnectingDs}
                      >
                        {connectingDs ? 'Reconectando…' : 'Reconectar'}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={disconnectDocuSign}
                        disabled={connectingDs || disconnectingDs}
                      >
                        {disconnectingDs
                          ? 'Desconectando…'
                          : 'Desconectar'}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              ) : (
                <Stack gap={1}>
                  <Typography fontSize={13} color={C.textMuted}>
                    Credenciais cadastradas mas ainda sem sessão. Clique
                    pra autorizar sua conta DocuSign.
                  </Typography>
                  {canEdit && (
                    <Box>
                      <Button
                        variant="contained"
                        onClick={connectDocuSign}
                        disabled={connectingDs}
                      >
                        {connectingDs
                          ? 'Redirecionando…'
                          : 'Conectar DocuSign'}
                      </Button>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
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
                Modelos de contrato{' '}
                {provider === 'docusign' ? '(DocuSign)' : '(ClickSign)'}
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

            {templates.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                O ID abaixo é usado pelo provider ativo{' '}
                <strong>
                  ({provider === 'docusign' ? 'DocuSign' : 'ClickSign'})
                </strong>
                . Se você trocou de provider recentemente, revise cada modelo
                e cole o ID do template no provider correto — caso contrário
                o envio do contrato vai falhar com{' '}
                <code>TEMPLATE_ID_INVALID</code>.
              </Alert>
            )}

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
                        fontSize={10}
                        color={C.textMuted}
                        sx={{ letterSpacing: 0.05 }}
                      >
                        {provider === 'docusign'
                          ? 'TEMPLATE ID DOCUSIGN'
                          : 'CHAVE MODELO CLICKSIGN'}
                      </Typography>
                      <Typography
                        fontSize={11}
                        color={C.textMuted}
                        fontFamily="monospace"
                        noWrap
                      >
                        {t.clicksign_template_key}
                      </Typography>
                      {provider === 'docusign' && t.docusign_role_name && (
                        <Typography fontSize={11} color={C.textMuted}>
                          Role: <code>{t.docusign_role_name}</code>
                        </Typography>
                      )}
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
            {provider === 'docusign' ? (
              <>
                {dsTemplatesError && (
                  <Alert
                    severity="warning"
                    action={
                      <Button size="small" onClick={loadDsTemplates}>
                        Tentar de novo
                      </Button>
                    }
                  >
                    {dsTemplatesError} Você ainda pode digitar o Template ID
                    manualmente abaixo.
                  </Alert>
                )}
                <Autocomplete
                  size="small"
                  fullWidth
                  freeSolo
                  loading={dsTemplatesLoading}
                  options={dsTemplates}
                  value={
                    dsTemplates.find(t => t.templateId === dlgKey) ?? dlgKey
                  }
                  onChange={(_, v) => {
                    if (typeof v === 'string') {
                      setDlgKey(v.trim());
                    } else if (v) {
                      setDlgKey(v.templateId);
                      // se dlgRole ainda vazio e o template tem só 1 role,
                      // auto-preenche pra o admin não errar.
                      if (!dlgRole && v.roles.length === 1) {
                        setDlgRole(v.roles[0]);
                      }
                    } else {
                      setDlgKey('');
                    }
                  }}
                  onInputChange={(_, v, reason) => {
                    // Digitação manual (freeSolo) — só considera se o
                    // reason for 'input', não 'reset'.
                    if (reason === 'input') setDlgKey(v.trim());
                  }}
                  getOptionLabel={o =>
                    typeof o === 'string' ? o : `${o.name} — ${o.templateId}`
                  }
                  isOptionEqualToValue={(a, b) =>
                    (typeof a === 'string' ? a : a.templateId) ===
                    (typeof b === 'string' ? b : b.templateId)
                  }
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography fontSize={13} fontWeight={600}>
                          {option.name}
                          {option.shared && (
                            <Typography
                              component="span"
                              fontSize={10}
                              color="text.secondary"
                              sx={{ ml: 1 }}
                            >
                              (shared)
                            </Typography>
                          )}
                        </Typography>
                        <Typography
                          fontSize={10}
                          color="text.secondary"
                          fontFamily="monospace"
                        >
                          {option.templateId}
                        </Typography>
                        {option.roles.length > 0 && (
                          <Typography fontSize={10} color="text.secondary">
                            roles: {option.roles.join(', ')}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Template DocuSign"
                      placeholder="Escolha ou cole o Template ID"
                      helperText={
                        dsTemplates.length > 0
                          ? `${dsTemplates.length} template(s) acessíveis pela sua conta DocuSign.`
                          : dsTemplatesLoading
                            ? 'Carregando…'
                            : 'Se seu template não aparece aqui, ele não é acessível pela conta OAuth conectada.'
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {dsTemplatesLoading && (
                              <CircularProgress size={14} />
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <Autocomplete
                  size="small"
                  fullWidth
                  freeSolo
                  options={
                    // Se dlgKey bater com um template listado, mostra
                    // só os roles daquele template. Senão, agrega
                    // todos os roles vistos.
                    (
                      dsTemplates.find(t => t.templateId === dlgKey)
                        ?.roles ??
                      Array.from(
                        new Set(dsTemplates.flatMap(t => t.roles)),
                      )
                    ) as string[]
                  }
                  value={dlgRole}
                  onChange={(_, v) => setDlgRole(v ?? '')}
                  onInputChange={(_, v, reason) => {
                    if (reason === 'input') setDlgRole(v);
                  }}
                  renderInput={params => (
                    <TextField
                      {...params}
                      label="Role Name (DocuSign)"
                      placeholder="Ex.: Signer1, Credenciado"
                      helperText="Case-sensitive. Precisa bater EXATO com o Role do template."
                    />
                  )}
                />
              </>
            ) : (
              <TextField
                size="small"
                fullWidth
                label="Chave do modelo no ClickSign"
                placeholder="uuid do template no ClickSign"
                value={dlgKey}
                onChange={e => setDlgKey(e.target.value.trim())}
                helperText={
                  <>
                    Pega no dashboard do ClickSign em{' '}
                    <Link
                      href="https://app.clicksign.com/templates"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Modelos
                    </Link>
                    .
                  </>
                }
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
