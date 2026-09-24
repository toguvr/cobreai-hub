import { useEffect, useState } from 'react';
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
  Link as MuiLink,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';

type Status = 'pending' | 'approved' | 'rejected';

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

interface RegistrationLink {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface HospitalRequest {
  id: string;
  status: Status;
  name: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  min_hours: number | null;
  min_tolerance: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  rejection_reason: string | null;
  hospital_id: string | null;
  created_at: string;
  link?: RegistrationLink | null;
}

function formatAddress(item: HospitalRequest): string {
  const street = [item.logradouro, item.numero].filter(Boolean).join(', ');
  const city = [item.cidade, item.uf].filter(Boolean).join(' - ');

  return [street, item.bairro, city, item.cep].filter(Boolean).join(' · ');
}

export default function HospitalRegistrations() {
  const { current } = useEnterprise();

  const [tab, setTab] = useState<Status>('pending');
  const [items, setItems] = useState<HospitalRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkExpiresDays, setNewLinkExpiresDays] = useState('30');
  const [creatingLink, setCreatingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const [acting, setActing] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<HospitalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const publicUrl = (token: string) =>
    `${window.location.origin}/cadastro-hospital/link/${token}`;

  const loadLinks = async () => {
    if (!current?.id) return;
    setLoadingLinks(true);
    try {
      const res = await api.get<RegistrationLink[]>(
        `/enterprise/${current.id}/hospital-registration-links`,
      );
      setLinks(res.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao carregar os links.');
    } finally {
      setLoadingLinks(false);
    }
  };

  const load = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get<HospitalRequest[]>(
        `/enterprise/${current.id}/hospital-registrations`,
        { params: { status: tab } },
      );
      setItems(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar as solicitações.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [current?.id]);

  useEffect(() => {
    load();
  }, [current?.id, tab]);

  const createLink = async () => {
    if (!current?.id) return;
    setCreatingLink(true);
    try {
      const body: { label?: string; expires_at?: string } = {};
      if (newLinkLabel.trim()) body.label = newLinkLabel.trim();

      const days = Number(newLinkExpiresDays);
      if (Number.isFinite(days) && days > 0) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        body.expires_at = date.toISOString();
      }

      await api.post(
        `/enterprise/${current.id}/hospital-registration-links`,
        body,
      );
      toast.success('Link criado.');
      setLinkModalOpen(false);
      setNewLinkLabel('');
      setNewLinkExpiresDays('30');
      await loadLinks();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao criar o link.');
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
        `/enterprise/${current.id}/hospital-registration-links/${link.id}`,
      );
      toast.success('Link revogado.');
      await loadLinks();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao revogar.');
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      setCopied(true);
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

  const approve = async (item: HospitalRequest) => {
    if (!current?.id) return;
    setActing(item.id);
    try {
      await api.put(
        `/enterprise/${current.id}/hospital-registrations/${item.id}/approve`,
      );
      toast.success(`${item.name} criado e vinculado à organização.`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao aprovar.');
    } finally {
      setActing(null);
    }
  };

  const reject = async () => {
    if (!current?.id || !rejectItem) return;
    setActing(rejectItem.id);
    try {
      await api.put(
        `/enterprise/${current.id}/hospital-registrations/${rejectItem.id}/reject`,
        { reason: rejectReason.trim() },
      );
      toast.success('Solicitação rejeitada.');
      setRejectItem(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao rejeitar.');
    } finally {
      setActing(null);
    }
  };

  return (
    <PrivateLayout>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        mb={2}
      >
        <Box>
          <Typography fontSize={20} fontWeight={600}>
            Cadastro de hospitais
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            Compartilhe um link para alguém de fora preencher os dados. O
            hospital só é criado quando você aprovar.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setLinkModalOpen(true)}
        >
          Gerar link
        </Button>
      </Stack>

      {/* ─── Links ─────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography fontSize={13} fontWeight={600}>
            Links ativos
          </Typography>
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
            Nenhum link gerado. Clique em <b>Gerar link</b> para começar.
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {links.map(link => {
              const url = publicUrl(link.token);
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
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      mb={0.5}
                    >
                      <Typography fontSize={13} fontWeight={600}>
                        {link.label || 'Sem identificação'}
                      </Typography>
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
                        ` · expira em ${new Date(
                          link.expires_at,
                        ).toLocaleDateString('pt-BR')}`}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Copiar link">
                      <span>
                        <IconButton
                          size="small"
                          disabled={inactive}
                          onClick={() => copyLink(link.token)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Revogar link">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={isRevoked}
                          onClick={() => revokeLink(link)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* ─── Solicitações ──────────────────────────────────────── */}
      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ px: 1 }}
        >
          <Tab label="Pendentes" value="pending" />
          <Tab label="Aprovados" value="approved" />
          <Tab label="Rejeitados" value="rejected" />
        </Tabs>
        <Divider />

        {loading ? (
          <Box p={4} display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : items.length === 0 ? (
          <Box p={4} textAlign="center" color="text.secondary" fontSize={13}>
            Nenhuma solicitação {STATUS_LABEL[tab].toLowerCase()}.
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {items.map(item => (
              <Stack
                key={item.id}
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ md: 'center' }}
                sx={{ p: 2 }}
              >
                <Box flex={1} minWidth={0}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    mb={0.5}
                  >
                    <Typography fontSize={14} fontWeight={600}>
                      {item.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={STATUS_LABEL[item.status]}
                      color={STATUS_COLOR[item.status]}
                      variant="outlined"
                    />
                  </Stack>

                  {formatAddress(item) && (
                    <Typography fontSize={12} color="text.secondary">
                      {formatAddress(item)}
                    </Typography>
                  )}

                  {(item.min_hours != null || item.min_tolerance != null) && (
                    <Typography fontSize={12} color="text.secondary">
                      {item.min_hours != null &&
                        `Mín. ${item.min_hours}h de plantão`}
                      {item.min_hours != null &&
                        item.min_tolerance != null &&
                        ' · '}
                      {item.min_tolerance != null &&
                        `tolerância de ${item.min_tolerance} min`}
                    </Typography>
                  )}

                  {(item.contact_name ||
                    item.contact_email ||
                    item.contact_phone) && (
                    <Typography fontSize={12} color="text.secondary" mt={0.5}>
                      Enviado por{' '}
                      {[
                        item.contact_name,
                        item.contact_email,
                        item.contact_phone,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  )}

                  {item.notes && (
                    <Typography fontSize={12} color="text.secondary" mt={0.5}>
                      “{item.notes}”
                    </Typography>
                  )}

                  {item.status === 'rejected' && item.rejection_reason && (
                    <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                      {item.rejection_reason}
                    </Alert>
                  )}

                  <Typography fontSize={11} color="text.secondary" mt={0.5}>
                    Recebido em{' '}
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                    {item.link?.label && ` · link “${item.link.label}”`}
                  </Typography>
                </Box>

                {item.status === 'pending' && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleIcon />}
                      disabled={acting === item.id}
                      onClick={() => approve(item)}
                    >
                      Aprovar e criar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<CancelIcon />}
                      disabled={acting === item.id}
                      onClick={() => {
                        setRejectItem(item);
                        setRejectReason('');
                      }}
                    >
                      Rejeitar
                    </Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      {/* ─── Dialog: novo link ─────────────────────────────────── */}
      <Dialog
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Gerar link de cadastro</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <Typography fontSize={13} color="text.secondary">
              Quem abrir o link preenche os dados do hospital sem precisar de
              login. A solicitação cai aqui para você aprovar.
            </Typography>
            <TextField
              label="Identificação (opcional)"
              size="small"
              fullWidth
              placeholder="Ex.: Hospital São Lucas — diretoria"
              value={newLinkLabel}
              onChange={e => setNewLinkLabel(e.target.value)}
              helperText="Só para você lembrar a quem mandou este link."
            />
            <TextField
              label="Expira em (dias)"
              size="small"
              type="number"
              fullWidth
              value={newLinkExpiresDays}
              onChange={e => setNewLinkExpiresDays(e.target.value)}
              helperText="Deixe 0 ou vazio para não expirar."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkModalOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={createLink}
            disabled={creatingLink}
          >
            {creatingLink ? 'Gerando…' : 'Gerar link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Dialog: rejeitar ──────────────────────────────────── */}
      <Dialog
        open={!!rejectItem}
        onClose={() => setRejectItem(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rejeitar solicitação</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <Typography fontSize={13} color="text.secondary">
              {rejectItem?.name}
            </Typography>
            <TextField
              label="Motivo"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectItem(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={reject}
            disabled={rejectReason.trim().length < 3 || !!acting}
          >
            Rejeitar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Link copiado"
      />
    </PrivateLayout>
  );
}
