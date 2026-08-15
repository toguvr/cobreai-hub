import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface UploadContext {
  enterprise: {
    title: string;
    primary_color: string | null;
    logo_url: string | null;
  };
  professional_name: string | null;
  month: string;
  bruto: number;
  hospitals: Array<{
    name: string | null;
    appointments: number;
    bruto: number;
  }>;
  status:
    | 'awaiting_upload'
    | 'submitted_awaiting_review'
    | 'rejected_needs_new_upload'
    | 'closed';
  rejection_reason: string | null;
  already_uploaded_at: string | null;
}

const BRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export default function NfUpload() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<UploadContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const xmlInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<UploadContext>(
        `/public/nf-upload/${token}`,
      );
      setCtx(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Link inválido, expirado ou já encerrado.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const submit = async () => {
    if (!pdf) {
      toast.error('Selecione o PDF da nota fiscal.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('pdf', pdf);
      if (xml) form.append('xml', xml);
      await api.post(`/public/nf-upload/${token}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('NF-e enviada com sucesso!');
      setPdf(null);
      setXml(null);
      await load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Falha ao enviar a nota fiscal.',
      );
    } finally {
      setUploading(false);
    }
  };

  const primary = ctx?.enterprise.primary_color || '#0f172a';

  if (loading) {
    return (
      <Container sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 6 }} maxWidth="sm">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography color="text.secondary" fontSize={13} textAlign="center">
          Verifique se o link do e-mail está completo. Em caso de dúvida,
          entre em contato com quem solicitou a NF-e.
        </Typography>
      </Container>
    );
  }

  if (!ctx) return null;

  return (
    <Box sx={{ bgcolor: '#f4f6f8', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: primary,
              color: '#fff',
              px: { xs: 3, md: 4 },
              py: 3,
              textAlign: 'center',
            }}
          >
            {ctx.enterprise.logo_url ? (
              <Box
                component="img"
                src={ctx.enterprise.logo_url}
                alt={ctx.enterprise.title}
                sx={{ maxHeight: 44, mb: 1 }}
              />
            ) : (
              <Typography fontWeight={700} fontSize={20}>
                {ctx.enterprise.title}
              </Typography>
            )}
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="h5" fontWeight={700} mb={0.5}>
              Envio de Nota Fiscal
            </Typography>
            <Typography color="text.secondary" fontSize={13} mb={2}>
              Referente a <strong>{ctx.professional_name ?? '—'}</strong> —
              competência {monthLabel(ctx.month)}.
            </Typography>

            {ctx.status === 'submitted_awaiting_review' && (
              <Alert
                severity="success"
                icon={<CheckCircleIcon />}
                sx={{ mb: 2 }}
              >
                <Typography fontWeight={600}>
                  Nota fiscal já recebida.
                </Typography>
                {ctx.already_uploaded_at && (
                  <Typography fontSize={12}>
                    Enviada em{' '}
                    {new Date(ctx.already_uploaded_at).toLocaleString('pt-BR')}
                    . A empresa vai conferir e retornar caso precise de ajuste.
                  </Typography>
                )}
              </Alert>
            )}

            {ctx.status === 'rejected_needs_new_upload' &&
              ctx.rejection_reason && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography fontWeight={600}>
                    NF-e anterior rejeitada.
                  </Typography>
                  <Typography fontSize={13}>
                    Motivo: {ctx.rejection_reason}
                  </Typography>
                  <Typography fontSize={12} mt={0.5}>
                    Corrija e envie a NF-e novamente pelo formulário abaixo.
                  </Typography>
                </Alert>
              )}

            {ctx.status === 'closed' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Este link foi encerrado — a NF-e já foi processada.
              </Alert>
            )}

            {/* Resumo dos plantões */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, mb: 3 }}
            >
              <Typography
                fontSize={11}
                color="text.secondary"
                letterSpacing={0.05}
                mb={0.5}
              >
                INFORMAÇÕES DOS SERVIÇOS PRESTADOS
              </Typography>
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
                      VALOR BRUTO
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ctx.hospitals.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontSize: 13 }}>
                        {h.name ?? '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>
                        {h.appointments}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 13 }}>
                        {BRL(h.bruto)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
                      TOTAL BRUTO
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, color: primary }}
                    >
                      {BRL(ctx.bruto)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            {(ctx.status === 'awaiting_upload' ||
              ctx.status === 'rejected_needs_new_upload' ||
              ctx.status === 'submitted_awaiting_review') && (
              <>
                <Divider sx={{ my: 2 }} />

                <Typography fontWeight={600} mb={1}>
                  Envie os arquivos da NF-e
                </Typography>
                <Typography fontSize={12} color="text.secondary" mb={2}>
                  O PDF é obrigatório. O XML é recomendado sempre que disponível.
                </Typography>

                <Stack gap={2}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderStyle: 'dashed',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f8fafc' },
                    }}
                    onClick={() => pdfInput.current?.click()}
                  >
                    <input
                      ref={pdfInput}
                      type="file"
                      accept="application/pdf,.pdf"
                      style={{ display: 'none' }}
                      onChange={e => setPdf(e.target.files?.[0] ?? null)}
                    />
                    <Stack direction="row" gap={1.5} alignItems="center">
                      <UploadFileIcon color="primary" />
                      <Box flex={1}>
                        <Typography fontWeight={600} fontSize={14}>
                          PDF da NF-e
                        </Typography>
                        <Typography fontSize={12} color="text.secondary">
                          {pdf?.name ??
                            'Clique pra selecionar o arquivo (obrigatório)'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderStyle: 'dashed',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f8fafc' },
                    }}
                    onClick={() => xmlInput.current?.click()}
                  >
                    <input
                      ref={xmlInput}
                      type="file"
                      accept="application/xml,text/xml,.xml"
                      style={{ display: 'none' }}
                      onChange={e => setXml(e.target.files?.[0] ?? null)}
                    />
                    <Stack direction="row" gap={1.5} alignItems="center">
                      <UploadFileIcon color="action" />
                      <Box flex={1}>
                        <Typography fontWeight={600} fontSize={14}>
                          XML da NF-e (opcional)
                        </Typography>
                        <Typography fontSize={12} color="text.secondary">
                          {xml?.name ?? 'Clique pra selecionar o XML'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={
                      uploading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <CloudUploadIcon />
                      )
                    }
                    disabled={!pdf || uploading}
                    onClick={submit}
                    sx={{
                      textTransform: 'none',
                      bgcolor: primary,
                      '&:hover': { bgcolor: primary, filter: 'brightness(0.9)' },
                    }}
                  >
                    {ctx.status === 'submitted_awaiting_review'
                      ? 'Substituir NF-e enviada'
                      : ctx.status === 'rejected_needs_new_upload'
                        ? 'Enviar NF-e corrigida'
                        : 'Enviar Nota Fiscal'}
                  </Button>
                </Stack>
              </>
            )}
          </Box>

          <Box
            sx={{
              bgcolor: '#f8fafc',
              px: 4,
              py: 2,
              borderTop: '1px solid #e5e7eb',
              textAlign: 'center',
            }}
          >
            <Typography fontSize={11} color="text.secondary">
              © {new Date().getFullYear()} {ctx.enterprise.title}
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
