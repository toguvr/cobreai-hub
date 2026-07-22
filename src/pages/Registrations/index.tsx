import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  Snackbar,
  Link as MuiLink,
  IconButton,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuItem from '@mui/material/MenuItem';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';

type Status = 'pending' | 'approved' | 'rejected';

interface UserBrief {
  id: string;
  name: string;
  email: string;
  cellphone?: string;
  cpf?: string;
  rg?: string;
  crm?: string;
  sus?: string;
  avatar_url?: string;
}

interface Registration {
  id: string; // user_enterprise_id
  user_id: string;
  enterprise_id: string;
  status: Status;
  rejection_reason?: string | null;
  approved_at?: string | null;
  contract_envelope_id?: string | null;
  contract_sent_at?: string | null;
  created_at: string;
  user?: UserBrief;
}

interface UserDoc {
  id: string;
  user_id: string;
  enterprise_document_type_id: string;
  document_url?: string | null;
  document?: string | null;
  enterpriseDocumentType?: { id: string; name: string; required: boolean };
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_COLOR: Record<Status, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

type BankMode = 'none' | 'pf' | 'pj' | 'both';

const BANK_MODE_LABEL: Record<BankMode, string> = {
  none: 'Sem dados bancários',
  pf: 'Somente PF',
  pj: 'Somente PJ',
  both: 'PF e PJ',
};

interface RegistrationLink {
  id: string;
  token: string;
  bank_mode: BankMode;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  clicksign_template_key: string;
  description: string | null;
}

export default function Registrations() {
  const { current } = useEnterprise();
  const [tab, setTab] = useState<Status>('pending');
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal de detalhes + ações
  const [selected, setSelected] = useState<Registration | null>(null);
  const [docs, setDocs] = useState<UserDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [acting, setActing] = useState(false);

  // Sub-modal de rejeição
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Snackbar do copiar link
  const [copied, setCopied] = useState(false);

  // Links de convite (tokenizados, com bank_mode)
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [newLinkBankMode, setNewLinkBankMode] = useState<BankMode>('none');
  const [newLinkExpiresDays, setNewLinkExpiresDays] = useState<string>('30');
  const [creatingLink, setCreatingLink] = useState(false);

  // Modelos de contrato cadastrados na empresa (pra dropdown do
  // botão "Gerar contrato"). Carregados junto com o resto da tela.
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const loadLinks = async () => {
    if (!current?.id) return;
    setLoadingLinks(true);
    try {
      const res = await api.get<RegistrationLink[]>(
        `/enterprise/${current.id}/registration-links`,
      );
      setLinks(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar links de convite.',
      );
    } finally {
      setLoadingLinks(false);
    }
  };

  const createLink = async () => {
    if (!current?.id) return;
    setCreatingLink(true);
    try {
      const body: {
        bank_mode: BankMode;
        expires_at?: string;
      } = { bank_mode: newLinkBankMode };
      const days = Number(newLinkExpiresDays);
      if (Number.isFinite(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        body.expires_at = d.toISOString();
      }
      await api.post(`/enterprise/${current.id}/registration-links`, body);
      toast.success('Link de convite criado.');
      setLinkModalOpen(false);
      setNewLinkBankMode('none');
      setNewLinkExpiresDays('30');
      await loadLinks();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao criar link. Tente novamente.',
      );
    } finally {
      setCreatingLink(false);
    }
  };

  const revokeLink = async (link: RegistrationLink) => {
    if (!current?.id) return;
    if (
      !window.confirm(
        'Revogar este link? Quem já tiver o link não conseguirá mais usá-lo.',
      )
    )
      return;
    try {
      await api.delete(
        `/enterprise/${current.id}/registration-links/${link.id}`,
      );
      toast.success('Link revogado.');
      await loadLinks();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao revogar.');
    }
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/credenciamento/link/${token}`,
      );
      setCopied(true);
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

  const load = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get<Registration[]>(
        `/enterprise/${current.id}/registrations`,
        { params: { status: tab } },
      );
      setItems(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar credenciamentos.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, tab]);

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (!current?.id) return;
    (async () => {
      try {
        const res = await api.get<ContractTemplate[]>(
          `/enterprise/${current.id}/contract-templates`,
        );
        setTemplates(res.data ?? []);
        // Se só tem 1, seleciona automaticamente pra economizar clique.
        if ((res.data ?? []).length === 1) {
          setSelectedTemplateId(res.data![0].id);
        } else {
          setSelectedTemplateId('');
        }
      } catch {
        // silencioso: se falhar, o botão de gerar contrato mostra
        // "configure em /configurações" quando o admin abrir o modal.
        setTemplates([]);
      }
    })();
  }, [current?.id]);

  const openDetails = async (item: Registration) => {
    setSelected(item);
    setDocs([]);
    if (!current?.id) return;
    setLoadingDocs(true);
    try {
      const res = await api.get<UserDoc[]>(
        `/enterprise/${current.id}/user-documents/by-user/${item.user_id}`,
      );
      setDocs(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar documentos.',
      );
    } finally {
      setLoadingDocs(false);
    }
  };

  const approve = async () => {
    if (!selected || !current?.id) return;
    setActing(true);
    try {
      await api.put(
        `/enterprise/${current.id}/registrations/${selected.id}/approve`,
      );
      toast.success('Credenciamento aprovado. E-mail enviado ao médico.');
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao aprovar. Tente novamente.',
      );
    } finally {
      setActing(false);
    }
  };

  const sendContract = async (force = false) => {
    if (!selected || !current?.id) return;
    if (!selectedTemplateId) {
      toast.warning('Selecione um modelo de contrato antes.');
      return;
    }
    setActing(true);
    try {
      const res = await api.post<{
        envelope_id: string;
        user_enterprise: Registration;
      }>(`/enterprise/${current.id}/registrations/${selected.id}/contract`, {
        template_id: selectedTemplateId,
        force,
      });
      toast.success(
        'Contrato gerado. O médico recebeu o e-mail do ClickSign pra assinar.',
      );
      // Atualiza o item selecionado com os novos campos pra refletir
      // no modal sem re-fetch (envelope_id/sent_at).
      setSelected(prev =>
        prev
          ? {
              ...prev,
              contract_envelope_id: res.data.envelope_id,
              contract_sent_at: new Date().toISOString(),
            }
          : prev,
      );
      await load();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 409) {
        // Já enviou — pergunta se quer reenviar.
        if (
          window.confirm(
            'Contrato já foi enviado antes. Deseja gerar um novo envelope e reenviar?',
          )
        ) {
          await sendContract(true);
          return;
        }
      } else {
        toast.error(msg || 'Erro ao gerar contrato. Tente novamente.');
      }
    } finally {
      setActing(false);
    }
  };

  const reject = async () => {
    if (!selected || !current?.id) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      toast.warning('Informe um motivo (mínimo 3 caracteres).');
      return;
    }
    setActing(true);
    try {
      await api.put(
        `/enterprise/${current.id}/registrations/${selected.id}/reject`,
        { reason: rejectReason.trim() },
      );
      toast.success('Credenciamento rejeitado. E-mail enviado ao médico.');
      setRejectOpen(false);
      setSelected(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao rejeitar. Tente novamente.',
      );
    } finally {
      setActing(false);
    }
  };

  return (
    <PrivateLayout>
      <Box p={{ xs: 2, md: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
          gap={2}
          mb={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Credenciamento
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              Aprove os cadastros dos médicos antes de vinculá-los aos
              hospitais.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setLinkModalOpen(true)}
          >
            Gerar link de convite
          </Button>
        </Stack>

        {/* Painel de links de convite (tokenizados, com bank_mode) */}
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, py: 1.5 }}
          >
            <Box>
              <Typography fontSize={13} fontWeight={600}>
                Links ativos
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                Cada link define se o médico preenche PF, PJ, ambos ou nenhum.
              </Typography>
            </Box>
            <IconButton onClick={loadLinks} disabled={loadingLinks} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Divider />

          {loadingLinks ? (
            <Box p={3} display="flex" justifyContent="center">
              <CircularProgress size={22} />
            </Box>
          ) : links.length === 0 ? (
            <Box p={3} textAlign="center" color="text.secondary" fontSize={13}>
              Nenhum link gerado. Clique em <b>Gerar link de convite</b> pra
              começar.
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {links.map(link => {
                const url = `${window.location.origin}/credenciamento/link/${link.token}`;
                const isRevoked = !!link.revoked_at;
                const isExpired =
                  !!link.expires_at &&
                  new Date(link.expires_at).getTime() < Date.now();
                const inactive = isRevoked || isExpired;
                return (
                  <Stack
                    key={link.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ sm: 'center' }}
                    spacing={1.5}
                    sx={{ p: 2, opacity: inactive ? 0.6 : 1 }}
                  >
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                        <Chip
                          size="small"
                          label={BANK_MODE_LABEL[link.bank_mode]}
                          color={
                            link.bank_mode === 'none'
                              ? 'default'
                              : link.bank_mode === 'both'
                              ? 'secondary'
                              : 'primary'
                          }
                          variant="outlined"
                        />
                        {isRevoked && (
                          <Chip size="small" label="Revogado" color="error" />
                        )}
                        {!isRevoked && isExpired && (
                          <Chip size="small" label="Expirado" color="warning" />
                        )}
                      </Stack>
                      <MuiLink
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          fontSize: 12,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                        }}
                      >
                        {url}
                      </MuiLink>
                      <Typography fontSize={11} color="text.secondary" mt={0.5}>
                        Criado em{' '}
                        {new Date(link.created_at).toLocaleDateString('pt-BR')}
                        {link.expires_at &&
                          ` · Expira em ${new Date(
                            link.expires_at,
                          ).toLocaleDateString('pt-BR')}`}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Copiar link">
                        <IconButton
                          size="small"
                          onClick={() => copyToken(link.token)}
                          disabled={inactive}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!isRevoked && (
                        <Tooltip title="Revogar">
                          <IconButton
                            size="small"
                            onClick={() => revokeLink(link)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined">
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 2, pt: 1 }}
          >
            <Tabs
              value={tab}
              onChange={(_e, v) => setTab(v)}
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="Pendentes" value="pending" />
              <Tab label="Aprovados" value="approved" />
              <Tab label="Rejeitados" value="rejected" />
            </Tabs>
            <IconButton onClick={load} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Stack>
          <Divider />

          {loading ? (
            <Box p={4} display="flex" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Box p={4} textAlign="center" color="text.secondary">
              Nenhum médico com status <b>{STATUS_LABEL[tab].toLowerCase()}</b>.
            </Box>
          ) : (
            <Stack divider={<Divider />}>
              {items.map(item => (
                <Stack
                  key={item.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'center' }}
                  spacing={2}
                  sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
                  onClick={() => openDetails(item)}
                >
                  <Avatar src={item.user?.avatar_url} sx={{ width: 40, height: 40 }}>
                    {(item.user?.name || '?').charAt(0)}
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography fontWeight={600} noWrap>
                      {item.user?.name || '(sem nome)'}
                    </Typography>
                    <Typography fontSize={13} color="text.secondary" noWrap>
                      {item.user?.email}
                      {item.user?.crm && ` · CRM ${item.user.crm}`}
                    </Typography>
                  </Box>
                  <Stack alignItems={{ sm: 'flex-end' }}>
                    <Chip
                      size="small"
                      label={STATUS_LABEL[item.status]}
                      color={STATUS_COLOR[item.status]}
                      variant="outlined"
                    />
                    <Typography fontSize={11} color="text.secondary" mt={0.5}>
                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Modal de detalhes */}
      <Dialog
        open={!!selected}
        onClose={() => !acting && setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Cadastro de {selected?.user?.name}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack gap={2}>
              <Box>
                <Typography fontSize={11} color="text.secondary" letterSpacing={0.5}>
                  DADOS PESSOAIS
                </Typography>
                <Typography fontSize={13}>E-mail: {selected.user?.email}</Typography>
                {selected.user?.cellphone && (
                  <Typography fontSize={13}>
                    Celular: {selected.user.cellphone}
                  </Typography>
                )}
                {selected.user?.cpf && (
                  <Typography fontSize={13}>CPF: {selected.user.cpf}</Typography>
                )}
                {selected.user?.rg && (
                  <Typography fontSize={13}>RG: {selected.user.rg}</Typography>
                )}
                {selected.user?.crm && (
                  <Typography fontSize={13}>CRM: {selected.user.crm}</Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography fontSize={11} color="text.secondary" letterSpacing={0.5}>
                  DOCUMENTOS ENVIADOS
                </Typography>
                {loadingDocs ? (
                  <Box p={1}>
                    <CircularProgress size={18} />
                  </Box>
                ) : docs.length === 0 ? (
                  <Typography fontSize={13} color="text.secondary" mt={1}>
                    Nenhum documento enviado.
                  </Typography>
                ) : (
                  <Stack gap={0.5} mt={1}>
                    {docs.map(d => (
                      <Stack
                        key={d.id}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography fontSize={13}>
                          {d.enterpriseDocumentType?.name ?? '(sem tipo)'}
                          {d.enterpriseDocumentType?.required && ' *'}
                        </Typography>
                        {d.document_url ? (
                          <MuiLink
                            href={d.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            fontSize={13}
                          >
                            abrir
                          </MuiLink>
                        ) : (
                          <Typography fontSize={12} color="text.secondary">
                            sem arquivo
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>

              {selected.status === 'rejected' && selected.rejection_reason && (
                <Alert severity="error">
                  <b>Motivo da rejeição:</b> {selected.rejection_reason}
                </Alert>
              )}
              {selected.status === 'approved' && selected.approved_at && (
                <Alert severity="success">
                  Aprovado em{' '}
                  {new Date(selected.approved_at).toLocaleString('pt-BR')}.
                </Alert>
              )}
              {selected.status === 'approved' &&
                selected.contract_sent_at && (
                  <Alert severity="info">
                    Contrato enviado em{' '}
                    {new Date(selected.contract_sent_at).toLocaleString(
                      'pt-BR',
                    )}
                    . O médico recebeu o e-mail do ClickSign pra assinar.
                  </Alert>
                )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={acting}>
            Fechar
          </Button>
          {selected?.status === 'pending' && (
            <>
              <Button
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setRejectOpen(true)}
                disabled={acting}
              >
                Rejeitar
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={approve}
                disabled={acting}
              >
                {acting ? 'Aprovando…' : 'Aprovar'}
              </Button>
            </>
          )}
          {selected?.status === 'approved' && templates.length === 0 && (
            <Typography fontSize={11} color="text.secondary" mr={1}>
              Cadastre um modelo em Configurações → Contratos.
            </Typography>
          )}
          {selected?.status === 'approved' && templates.length > 1 && (
            <TextField
              select
              size="small"
              label="Modelo"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              sx={{ minWidth: 180 }}
              disabled={acting}
            >
              {templates.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {selected?.status === 'approved' && templates.length >= 1 && (
            <Button
              variant="contained"
              onClick={() => sendContract(false)}
              disabled={acting || !selectedTemplateId}
            >
              {acting
                ? 'Gerando…'
                : selected.contract_sent_at
                ? 'Reenviar contrato'
                : 'Gerar contrato'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Sub-modal de rejeição */}
      <Dialog
        open={rejectOpen}
        onClose={() => !acting && setRejectOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Motivo da rejeição</DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="text.secondary" mb={2}>
            O motivo será enviado por e-mail pro médico.
          </Typography>
          <TextField
            autoFocus
            multiline
            minRows={3}
            fullWidth
            placeholder="Ex.: Documento X está ilegível — reenvie."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} disabled={acting}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={reject}
            disabled={acting}
          >
            {acting ? 'Rejeitando…' : 'Confirmar rejeição'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de criação de link de convite */}
      <Dialog
        open={linkModalOpen}
        onClose={() => !creatingLink && setLinkModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Novo link de convite</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              select
              label="Dados bancários"
              value={newLinkBankMode}
              onChange={e => setNewLinkBankMode(e.target.value as BankMode)}
              helperText="Escolha conforme o hospital em que o médico será vinculado."
              fullWidth
            >
              {(Object.keys(BANK_MODE_LABEL) as BankMode[]).map(k => (
                <MenuItem key={k} value={k}>
                  {BANK_MODE_LABEL[k]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Expira em (dias)"
              value={newLinkExpiresDays}
              onChange={e =>
                setNewLinkExpiresDays(e.target.value.replace(/\D/g, ''))
              }
              helperText="Deixe em branco pra link sem prazo."
              fullWidth
              inputMode="numeric"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setLinkModalOpen(false)}
            disabled={creatingLink}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={createLink}
            disabled={creatingLink}
          >
            {creatingLink ? 'Gerando…' : 'Gerar link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Link copiado!"
      />
    </PrivateLayout>
  );
}
