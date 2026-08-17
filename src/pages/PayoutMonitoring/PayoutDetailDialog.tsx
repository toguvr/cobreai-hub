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
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import PaidIcon from '@mui/icons-material/Paid';
import SendIcon from '@mui/icons-material/Send';
import DownloadIcon from '@mui/icons-material/Download';
import { toast } from 'react-toastify';
import api from '../../services/api';
import type { PayoutDetail } from '../../dtos';

const C = {
  border: '#e8eef2',
  textMuted: '#64748b',
  amber: '#b45309',
  green: '#15803d',
  red: '#b91c1c',
  blue: '#1d4ed8',
  purple: '#7c3aed',
};

const BRL = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const EVENT_LABEL: Record<string, string> = {
  published: 'Fechamento publicado pelo Cobreai',
  nf_requested: 'NF-e solicitada',
  nf_email_sent: 'E-mail de solicitação enviado',
  nf_email_failed: 'Falha no envio de e-mail',
  nf_received: 'NF-e recebida do médico/contador',
  nf_approved: 'NF-e aprovada',
  nf_rejected: 'NF-e rejeitada',
  paid: 'Pagamento confirmado',
};

const EVENT_COLOR: Record<string, string> = {
  published: C.textMuted,
  nf_requested: C.blue,
  nf_email_sent: C.blue,
  nf_email_failed: C.red,
  nf_received: C.purple,
  nf_approved: C.amber,
  nf_rejected: C.red,
  paid: C.green,
};

interface Props {
  enterpriseId: string;
  payoutId: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function PayoutDetailDialog({
  enterpriseId,
  payoutId,
  onClose,
  onChanged,
}: Props) {
  const [data, setData] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [paidNote, setPaidNote] = useState('');
  const [paidOpen, setPaidOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PayoutDetail>(
        `/enterprise/${enterpriseId}/payouts/${payoutId}`,
      );
      setData(res.data);
    } catch {
      toast.error('Falha ao carregar detalhe.');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId, payoutId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (
    action: 'approve' | 'reject' | 'mark-paid',
    body?: Record<string, unknown>,
  ) => {
    setActing(true);
    try {
      await api.post(
        `/enterprise/${enterpriseId}/payouts/${payoutId}/${action}`,
        body ?? {},
      );
      toast.success('Feito.');
      setRejectOpen(false);
      setPaidOpen(false);
      setRejectReason('');
      setPaidNote('');
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha na ação.');
    } finally {
      setActing(false);
    }
  };

  const requestNf = async () => {
    setActing(true);
    try {
      const res = await api.post<{
        results: Array<{ status: string; emails?: string[] }>;
      }>(`/enterprise/${enterpriseId}/payouts/request-nf`, {
        payout_ids: [payoutId],
      });
      const r = res.data.results[0];
      if (r?.status === 'sent') toast.success('E-mail enviado.');
      else if (r?.status === 'no_recipient')
        toast.error('Médico sem e-mail cadastrado.');
      else toast.warning('Não foi possível enviar.');
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha.');
    } finally {
      setActing(false);
    }
  };

  const p = data?.payout;
  const status = p?.status;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <Box flex={1}>
            <Typography fontWeight={700} fontSize={16}>
              {data?.user?.name ?? 'Detalhe do fechamento'}
            </Typography>
            {p && (
              <Typography fontSize={12} color={C.textMuted}>
                Competência {p.month} · {p.appointments_count} plantão(ões) ·{' '}
                {p.hospitals.length} hospital(is)
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading && !data && <CircularProgress size={20} />}

        {data && p && (
          <Stack gap={2}>
            {/* Cabeçalho de valores */}
            <Stack direction="row" gap={2} flexWrap="wrap">
              <Paper
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 140,
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                }}
              >
                <Typography fontSize={11} color={C.textMuted}>
                  BRUTO
                </Typography>
                <Typography fontSize={18} fontWeight={700}>
                  {BRL(p.bruto)}
                </Typography>
              </Paper>
              <Paper
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 140,
                  border: `1px solid ${C.border}`,
                  borderRadius: 2,
                }}
              >
                <Typography fontSize={11} color={C.textMuted}>
                  LÍQUIDO A PAGAR
                </Typography>
                <Typography fontSize={18} fontWeight={700} color={C.green}>
                  {BRL(p.liquido)}
                </Typography>
              </Paper>
            </Stack>

            {/* Dados do médico */}
            {data.user && (
              <Paper
                sx={{ p: 2, border: `1px solid ${C.border}`, borderRadius: 2 }}
              >
                <Typography fontSize={11} color={C.textMuted}>
                  MÉDICO
                </Typography>
                <Typography fontSize={14} fontWeight={600}>
                  {data.user.name}
                </Typography>
                <Typography fontSize={12}>
                  {data.user.email}
                  {data.user.crm
                    ? ` · CRM ${data.user.crm}${
                        data.user.crm_uf ? '/' + data.user.crm_uf : ''
                      }`
                    : ''}
                </Typography>
                {data.bankAccount?.is_pj && (
                  <Typography fontSize={12} mt={0.5}>
                    <strong>PJ:</strong> {data.bankAccount.company_name} · CNPJ{' '}
                    {data.bankAccount.cnpj}
                  </Typography>
                )}
                {data.bankAccount?.nf_emails &&
                  data.bankAccount.nf_emails.length > 0 && (
                    <Typography fontSize={11} color={C.textMuted} mt={0.5}>
                      E-mail(s) contador:{' '}
                      {data.bankAccount.nf_emails
                        .map(e => e.email)
                        .join(', ')}
                    </Typography>
                  )}
              </Paper>
            )}

            {/* Hospitais */}
            <Paper
              sx={{ border: `1px solid ${C.border}`, borderRadius: 2 }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      HOSPITAL
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      PLANTÕES
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      BRUTO
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    >
                      LÍQUIDO
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.hospitals.map(h => (
                    <TableRow key={h.id}>
                      <TableCell sx={{ fontSize: 13 }}>
                        {h.hospital_name_snapshot ?? '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>
                        {h.appointments}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>
                        {BRL(h.bruto)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: 13, fontWeight: 600 }}
                      >
                        {BRL(h.liquido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>

            {/* Rejeição atual */}
            {status === 'nf_rejected' && p.nf_rejection_reason && (
              <Alert severity="error">
                <strong>NF-e rejeitada.</strong> Motivo: {p.nf_rejection_reason}
                <br />
                <Typography component="span" fontSize={11}>
                  Um e-mail foi enviado ao médico/contador pedindo novo envio.
                </Typography>
              </Alert>
            )}

            {/* NF-e recebida */}
            {(status === 'nf_received' ||
              status === 'nf_approved' ||
              status === 'paid') &&
              p.nf_file_url && (
                <Paper
                  sx={{
                    p: 2,
                    border: `1px solid ${C.border}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography fontSize={12} color={C.textMuted} mb={1}>
                    ARQUIVOS DA NF-e
                  </Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      href={p.nf_file_url}
                      target="_blank"
                      sx={{ textTransform: 'none' }}
                    >
                      PDF
                    </Button>
                    {p.nf_file_xml_url && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        href={p.nf_file_xml_url}
                        target="_blank"
                        sx={{ textTransform: 'none' }}
                      >
                        XML
                      </Button>
                    )}
                    <Typography
                      fontSize={11}
                      color={C.textMuted}
                      alignSelf="center"
                    >
                      Enviado em{' '}
                      {p.nf_received_at
                        ? new Date(p.nf_received_at).toLocaleString('pt-BR')
                        : '—'}
                    </Typography>
                  </Stack>
                </Paper>
              )}

            {/* Timeline */}
            <Divider>Histórico</Divider>
            <Stack gap={1}>
              {p.events.map(e => {
                const label = EVENT_LABEL[e.action] || e.action;
                const color = EVENT_COLOR[e.action] || C.textMuted;
                const meta = e.metadata as
                  | { emails?: string[]; reason?: string; note?: string }
                  | null;
                return (
                  <Stack
                    key={e.id}
                    direction="row"
                    gap={1}
                    alignItems="flex-start"
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        bgcolor: color,
                        borderRadius: '50%',
                        mt: 0.6,
                      }}
                    />
                    <Box flex={1}>
                      <Typography fontSize={13}>{label}</Typography>
                      {meta?.emails && meta.emails.length > 0 && (
                        <Typography fontSize={11} color={C.textMuted}>
                          Destinatários: {meta.emails.join(', ')}
                        </Typography>
                      )}
                      {meta?.reason && (
                        <Typography fontSize={11} color={C.red}>
                          Motivo: {meta.reason}
                        </Typography>
                      )}
                      {meta?.note && (
                        <Typography fontSize={11} color={C.textMuted}>
                          Nota: {meta.note}
                        </Typography>
                      )}
                    </Box>
                    <Typography fontSize={11} color={C.textMuted}>
                      {new Date(e.created_at).toLocaleString('pt-BR')}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        )}

        {/* Dialog: rejeitar */}
        <Dialog
          open={rejectOpen}
          onClose={() => setRejectOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Rejeitar NF-e</DialogTitle>
          <DialogContent>
            <Typography fontSize={13} color={C.textMuted} mb={1.5}>
              Informe o motivo — o médico/contador vai receber um e-mail com
              essa mensagem e um link pra reenviar a nota corrigida.
            </Typography>
            <TextField
              autoFocus
              multiline
              minRows={4}
              fullWidth
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ex.: valor divergente do fechamento; competência incorreta; falta o XML..."
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setRejectOpen(false)}
              sx={{ textTransform: 'none' }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => act('reject', { reason: rejectReason })}
              disabled={acting || rejectReason.trim().length < 3}
              startIcon={acting ? <CircularProgress size={14} /> : null}
              sx={{ textTransform: 'none' }}
            >
              Rejeitar e notificar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog: marcar como pago */}
        <Dialog
          open={paidOpen}
          onClose={() => setPaidOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Marcar como pago</DialogTitle>
          <DialogContent>
            <Typography fontSize={13} color={C.textMuted} mb={1.5}>
              Confirma o pagamento? Opcionalmente adicione uma nota (comprovante,
              banco, etc.).
            </Typography>
            <TextField
              autoFocus
              multiline
              minRows={2}
              fullWidth
              value={paidNote}
              onChange={e => setPaidNote(e.target.value)}
              placeholder="Ex.: PIX 09/04/2026 - comprovante 123456..."
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setPaidOpen(false)}
              sx={{ textTransform: 'none' }}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() =>
                act('mark-paid', paidNote ? { note: paidNote } : {})
              }
              disabled={acting}
              startIcon={
                acting ? <CircularProgress size={14} /> : <PaidIcon />
              }
              sx={{ textTransform: 'none' }}
            >
              Confirmar pagamento
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Fechar
        </Button>
        {status === 'published' && (
          <Button
            variant="contained"
            startIcon={
              acting ? <CircularProgress size={14} /> : <SendIcon />
            }
            onClick={requestNf}
            disabled={acting}
            sx={{ textTransform: 'none' }}
          >
            Solicitar NF-e
          </Button>
        )}
        {status === 'nf_rejected' && (
          <Button
            variant="contained"
            startIcon={
              acting ? <CircularProgress size={14} /> : <SendIcon />
            }
            onClick={requestNf}
            disabled={acting}
            sx={{ textTransform: 'none' }}
          >
            Reenviar solicitação
          </Button>
        )}
        {status === 'nf_received' && (
          <>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ThumbDownIcon />}
              onClick={() => setRejectOpen(true)}
              disabled={acting}
              sx={{ textTransform: 'none' }}
            >
              Rejeitar
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={
                acting ? <CircularProgress size={14} /> : <CheckIcon />
              }
              onClick={() => act('approve')}
              disabled={acting}
              sx={{ textTransform: 'none' }}
            >
              Aprovar NF-e
            </Button>
          </>
        )}
        {status === 'nf_approved' && (
          <Button
            variant="contained"
            color="success"
            startIcon={<PaidIcon />}
            onClick={() => setPaidOpen(true)}
            disabled={acting}
            sx={{ textTransform: 'none' }}
          >
            Marcar como pago
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
