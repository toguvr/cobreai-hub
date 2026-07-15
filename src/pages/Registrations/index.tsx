import { useEffect, useMemo, useState } from 'react';
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

  const inviteLink = useMemo(() => {
    if (!current?.id) return '';
    return `${window.location.origin}/credenciamento/${current.id}/etapa1`;
  }, [current?.id]);

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

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

          <Paper
            variant="outlined"
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography fontSize={11} color="text.secondary" letterSpacing={0.5}>
                LINK DE CADASTRO PÚBLICO
              </Typography>
              <MuiLink
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                  maxWidth: 320,
                }}
              >
                {inviteLink}
              </MuiLink>
            </Box>
            <Tooltip title="Copiar link">
              <IconButton onClick={copyLink} size="small">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        </Stack>

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

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Link copiado!"
      />
    </PrivateLayout>
  );
}
