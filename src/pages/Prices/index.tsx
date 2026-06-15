import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import DownloadIcon from '@mui/icons-material/CloudDownload';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';
import api from '../../services/api';
import type {
  EnterprisePriceList,
  EnterprisePriceExpertise,
  EnterprisePriceVersion,
  EnterprisePriceRequest,
  EnterpriseClosingData,
} from '../../dtos';

const C = {
  border: '#e8eef2',
  borderSoft: '#f1f5f9',
  textMuted: '#64748b',
  surface: '#ffffff',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  green: '#15803d',
  greenSoft: '#f0fdf4',
};

const BRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
const addMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
};
const todayISO = () => new Date().toISOString().slice(0, 10);

interface PriceFormState {
  effective_from: string;
  doctor_price: string;
  total_price: string;
  doctor_fds_price: string;
  total_fds_price: string;
  monthly_doctor_price: string;
  monthly_total_price: string;
}

const emptyForm = (): PriceFormState => ({
  effective_from: todayISO(),
  doctor_price: '',
  total_price: '',
  doctor_fds_price: '',
  total_fds_price: '',
  monthly_doctor_price: '',
  monthly_total_price: '',
});

export default function Prices() {
  const { current, enterprises } = useEnterprise();
  const brand = useBrand();

  const isOrgAdmin = useMemo(() => {
    const link = enterprises.find(e => e.enterprise.id === current?.id);
    return link?.role === 'org_admin';
  }, [enterprises, current?.id]);

  const [tab, setTab] = useState(0);

  // ── Tabela de preços ──────────────────────────────────────────────
  const [priceList, setPriceList] = useState<EnterprisePriceList | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [requests, setRequests] = useState<EnterprisePriceRequest[]>([]);

  // edição
  const [editTarget, setEditTarget] = useState<{
    expertise: EnterprisePriceExpertise;
    hospital_name: string | null;
  } | null>(null);
  const [form, setForm] = useState<PriceFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // histórico
  const [historyTarget, setHistoryTarget] = useState<{
    expertise: EnterprisePriceExpertise;
  } | null>(null);
  const [history, setHistory] = useState<EnterprisePriceVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Fechamento ────────────────────────────────────────────────────
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [closing, setClosing] = useState<EnterpriseClosingData | null>(null);
  const [loadingClosing, setLoadingClosing] = useState(false);

  const loadPrices = useCallback(async () => {
    if (!current?.id) return;
    setLoadingPrices(true);
    try {
      const [pricesRes, requestsRes] = await Promise.all([
        api.get<EnterprisePriceList>(`/enterprise/${current.id}/prices`),
        api.get<EnterprisePriceRequest[]>(
          `/enterprise/${current.id}/price-requests`,
        ),
      ]);
      setPriceList(pricesRes.data);
      setRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
    } catch {
      toast.error('Falha ao carregar a tabela de preços.');
    } finally {
      setLoadingPrices(false);
    }
  }, [current?.id]);

  const loadClosing = useCallback(async () => {
    if (!current?.id) return;
    setLoadingClosing(true);
    try {
      const res = await api.get<EnterpriseClosingData>(
        `/enterprise/${current.id}/financial-closing`,
        { params: { month: monthKey } },
      );
      setClosing(res.data);
    } catch {
      toast.error('Falha ao carregar o fechamento.');
    } finally {
      setLoadingClosing(false);
    }
  }, [current?.id, monthKey]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    if (tab === 1) loadClosing();
  }, [tab, loadClosing]);

  // ── Ações ─────────────────────────────────────────────────────────

  const openEdit = (
    expertise: EnterprisePriceExpertise,
    hospital_name: string | null,
  ) => {
    setEditTarget({ expertise, hospital_name });
    if (expertise.current) {
      const c = expertise.current;
      setForm({
        effective_from: todayISO(),
        doctor_price: String(c.doctor_price ?? ''),
        total_price: String(c.total_price ?? ''),
        doctor_fds_price: String(c.doctor_fds_price ?? ''),
        total_fds_price: String(c.total_fds_price ?? ''),
        monthly_doctor_price: String(c.monthly_doctor_price ?? ''),
        monthly_total_price: String(c.monthly_total_price ?? ''),
      });
    } else {
      setForm(emptyForm());
    }
  };

  const handleSave = async () => {
    if (!current?.id || !editTarget) return;
    if (!form.effective_from) {
      toast.error('Informe a data de início da vigência.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/enterprise/${current.id}/prices`, {
        expertise_id: editTarget.expertise.expertise_id,
        effective_from: form.effective_from,
        doctor_price: Number(form.doctor_price) || 0,
        total_price: Number(form.total_price) || 0,
        doctor_fds_price: Number(form.doctor_fds_price) || 0,
        total_fds_price: Number(form.total_fds_price) || 0,
        monthly_doctor_price: Number(form.monthly_doctor_price) || 0,
        monthly_total_price: Number(form.monthly_total_price) || 0,
      });
      toast.success('Preço salvo.');
      setEditTarget(null);
      loadPrices();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Falha ao salvar o preço.',
      );
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (expertise: EnterprisePriceExpertise) => {
    if (!current?.id) return;
    setHistoryTarget({ expertise });
    setLoadingHistory(true);
    try {
      const res = await api.get<EnterprisePriceVersion[]>(
        `/enterprise/${current.id}/prices/${expertise.expertise_id}/history`,
      );
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Falha ao carregar o histórico.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const requestHospitalPrices = async (
    hospital_id: string,
    hospital_name: string | null,
  ) => {
    if (!current?.id) return;
    try {
      await api.post(`/enterprise/${current.id}/price-requests`, {
        hospital_id,
      });
      toast.success(
        `Solicitação enviada ao admin de ${hospital_name ?? 'hospital'}.`,
      );
      loadPrices();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Falha ao solicitar os preços.',
      );
    }
  };

  const requestByHospital = useMemo(() => {
    const map = new Map<string, EnterprisePriceRequest>();
    requests.forEach(r => {
      const prev = map.get(r.hospital_id);
      // mantém o mais recente
      if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
        map.set(r.hospital_id, r);
      }
    });
    return map;
  }, [requests]);

  // ── Render ────────────────────────────────────────────────────────

  if (!current) {
    return (
      <PrivateLayout>
        <Box p={3}>
          <Typography color={C.textMuted}>
            Selecione uma organização.
          </Typography>
        </Box>
      </PrivateLayout>
    );
  }

  return (
    <PrivateLayout>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Typography fontSize={22} fontWeight={700} mb={0.5}>
          Preços & Fechamento
        </Typography>
        <Typography fontSize={13} color={C.textMuted} mb={2}>
          Tabela de preços própria da empresa e fechamento financeiro
          reprecificado por ela.
        </Typography>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: `1px solid ${C.border}` }}
        >
          <Tab label="Tabela de preços" sx={{ textTransform: 'none' }} />
          <Tab label="Fechamento" sx={{ textTransform: 'none' }} />
        </Tabs>

        {/* ════════════ TAB 0: TABELA DE PREÇOS ════════════ */}
        {tab === 0 && (
          <Box>
            {loadingPrices && !priceList && (
              <Stack gap={1}>
                {[0, 1, 2].map(i => (
                  <Skeleton key={i} variant="rounded" height={64} />
                ))}
              </Stack>
            )}

            {priceList?.hospitals.length === 0 && !loadingPrices && (
              <Paper
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: `1px dashed ${C.border}`,
                }}
              >
                <Typography color={C.textMuted}>
                  Nenhum hospital vinculado a esta empresa.
                </Typography>
              </Paper>
            )}

            {priceList?.hospitals.map(group => {
              const req = requestByHospital.get(group.hospital_id);
              return (
                <Accordion
                  key={group.hospital_id}
                  defaultExpanded={group.missing_count > 0}
                  sx={{
                    mb: 1,
                    border: `1px solid ${C.border}`,
                    borderRadius: 2,
                    '&:before': { display: 'none' },
                    boxShadow: 'none',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      gap={1.5}
                      flex={1}
                      flexWrap="wrap"
                    >
                      <Typography fontWeight={600} fontSize={14}>
                        {group.hospital_name ?? 'Hospital'}
                      </Typography>
                      {group.missing_count > 0 ? (
                        <Chip
                          size="small"
                          icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                          label={`${group.missing_count} sem preço`}
                          sx={{
                            bgcolor: C.amberSoft,
                            color: C.amber,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                          label="Tabela completa"
                          sx={{
                            bgcolor: C.greenSoft,
                            color: C.green,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      )}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    {/* Banner solicitar preços */}
                    <Box mb={1.5}>
                      {req?.status === 'pending' && (
                        <Alert severity="info" sx={{ fontSize: 12 }}>
                          Solicitação de cópia dos preços enviada — aguardando
                          o admin do hospital aprovar.
                        </Alert>
                      )}
                      {req?.status === 'rejected' && (
                        <Alert severity="warning" sx={{ fontSize: 12 }}>
                          O admin do hospital recusou a cópia dos preços.
                          Cadastre manualmente abaixo.
                        </Alert>
                      )}
                      {isOrgAdmin &&
                        (!req || req.status === 'rejected') && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() =>
                              requestHospitalPrices(
                                group.hospital_id,
                                group.hospital_name,
                              )
                            }
                            sx={{ mt: req ? 1 : 0, textTransform: 'none' }}
                          >
                            Solicitar preços do hospital
                          </Button>
                        )}
                    </Box>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                            ESPECIALIDADE
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                            BRUTO (DU / FDS)
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                            LÍQUIDO (DU / FDS)
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                            VIGENTE DESDE
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, fontSize: 11 }}
                          >
                            AÇÕES
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.expertises.map(exp => {
                          const c = exp.current;
                          return (
                            <TableRow key={exp.expertise_id}>
                              <TableCell sx={{ fontSize: 13 }}>
                                {exp.expertise_name}
                              </TableCell>
                              <TableCell sx={{ fontSize: 13 }}>
                                {c ? (
                                  `${BRL(c.total_price)} / ${BRL(
                                    c.total_fds_price,
                                  )}`
                                ) : (
                                  <Chip
                                    size="small"
                                    label="Sem preço"
                                    sx={{
                                      bgcolor: C.amberSoft,
                                      color: C.amber,
                                      fontWeight: 600,
                                      fontSize: 11,
                                    }}
                                  />
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: 13 }}>
                                {c
                                  ? `${BRL(c.doctor_price)} / ${BRL(
                                      c.doctor_fds_price,
                                    )}`
                                  : '—'}
                              </TableCell>
                              <TableCell
                                sx={{ fontSize: 12, color: C.textMuted }}
                              >
                                {c
                                  ? new Date(
                                      c.effective_from,
                                    ).toLocaleDateString('pt-BR')
                                  : '—'}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Histórico de versões">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={exp.version_count === 0}
                                      onClick={() => openHistory(exp)}
                                    >
                                      <HistoryIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                {isOrgAdmin && (
                                  <Tooltip
                                    title={
                                      c
                                        ? 'Nova versão de preço'
                                        : 'Cadastrar preço'
                                    }
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        openEdit(exp, group.hospital_name)
                                      }
                                    >
                                      <EditIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {group.expertises.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              sx={{
                                textAlign: 'center',
                                color: C.textMuted,
                                fontSize: 13,
                              }}
                            >
                              Nenhuma especialidade neste hospital.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}

        {/* ════════════ TAB 1: FECHAMENTO ════════════ */}
        {tab === 1 && (
          <Box>
            {/* Navegação de mês */}
            <Stack
              direction="row"
              alignItems="center"
              gap={1}
              mb={2}
              flexWrap="wrap"
            >
              <IconButton
                size="small"
                onClick={() => setMonthKey(addMonth(monthKey, -1))}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography fontWeight={600} sx={{ minWidth: 150, textAlign: 'center' }}>
                {monthLabel(monthKey)}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setMonthKey(addMonth(monthKey, 1))}
              >
                <ChevronRightIcon />
              </IconButton>
              {loadingClosing && <CircularProgress size={16} />}
            </Stack>

            {loadingClosing && !closing && (
              <Skeleton variant="rounded" height={200} />
            )}

            {/* Banner de pendências — aparece em 'partial' e 'incomplete'.
                Em 'partial' o fechamento dos hospitais OK segue sendo
                exibido logo abaixo. */}
            {closing &&
              (closing.status === 'incomplete' ||
                closing.status === 'partial') &&
              closing.missing.length > 0 && (
                <Paper
                  sx={{
                    p: 3,
                    mb: 2,
                    border: `1px solid ${C.amber}33`,
                    bgcolor: C.amberSoft,
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" gap={1.5} alignItems="flex-start">
                    <WarningAmberIcon sx={{ color: C.amber }} />
                    <Box flex={1}>
                      <Typography fontWeight={700} color={C.amber} mb={0.5}>
                        {closing.status === 'incomplete'
                          ? 'Sem preços cadastrados — fechamento pendente'
                          : `Pendência em ${closing.missing.length} especialidade${
                              closing.missing.length === 1 ? '' : 's'
                            }`}
                      </Typography>
                      <Typography fontSize={13} color={C.textMuted} mb={1.5}>
                        {closing.status === 'incomplete'
                          ? `Cadastre o preço das especialidades abaixo (na aba "Tabela de preços") para fechar ${monthLabel(monthKey)}.`
                          : `Os hospitais e especialidades já com preço estão fechados normalmente. Cadastre os preços abaixo pra completar ${monthLabel(monthKey)}.`}
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                              HOSPITAL
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                              ESPECIALIDADE
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 700, fontSize: 11 }}
                            >
                              PLANTÕES AFETADOS
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {closing.missing.map(m => (
                            <TableRow
                              key={`${m.hospital_id}-${m.expertise_id}`}
                            >
                              <TableCell sx={{ fontSize: 13 }}>
                                {m.hospital_name ?? '—'}
                              </TableCell>
                              <TableCell sx={{ fontSize: 13 }}>
                                {m.expertise_name ?? '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: 13 }}>
                                {m.appointments_affected}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ mt: 2, textTransform: 'none' }}
                        onClick={() => setTab(0)}
                      >
                        Ir para a tabela de preços
                      </Button>
                    </Box>
                  </Stack>
                </Paper>
              )}

            {/* Estado: vazio */}
            {closing?.status === 'empty' && (
              <Paper
                sx={{
                  p: 4,
                  textAlign: 'center',
                  border: `1px dashed ${C.border}`,
                }}
              >
                <Typography color={C.textMuted}>
                  Nenhum plantão com check-in/check-out em{' '}
                  {monthLabel(monthKey)}.
                </Typography>
              </Paper>
            )}

            {/* Fechamento: aparece sempre que houver rows (status ok ou partial) */}
            {closing &&
              (closing.status === 'ok' || closing.status === 'partial') && (
              <Box>
                <Stack
                  direction="row"
                  gap={2}
                  mb={2}
                  flexWrap="wrap"
                >
                  <Paper
                    sx={{
                      p: 2,
                      flex: 1,
                      minWidth: 180,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography fontSize={11} color={C.textMuted}>
                      BRUTO TOTAL
                    </Typography>
                    <Typography fontSize={22} fontWeight={700}>
                      {BRL(closing.totals.bruto)}
                    </Typography>
                  </Paper>
                  <Paper
                    sx={{
                      p: 2,
                      flex: 1,
                      minWidth: 180,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography fontSize={11} color={C.textMuted}>
                      LÍQUIDO TOTAL
                    </Typography>
                    <Typography
                      fontSize={22}
                      fontWeight={700}
                      color={brand.primary}
                    >
                      {BRL(closing.totals.liquido)}
                    </Typography>
                  </Paper>
                  <Paper
                    sx={{
                      p: 2,
                      flex: 1,
                      minWidth: 180,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography fontSize={11} color={C.textMuted}>
                      PLANTÕES
                    </Typography>
                    <Typography fontSize={22} fontWeight={700}>
                      {closing.totals.appointments}
                    </Typography>
                  </Paper>
                </Stack>

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
                      {closing.rows.map(r => (
                        <TableRow key={r.hospital_id}>
                          <TableCell sx={{ fontSize: 13 }}>
                            {r.hospital_name ?? '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: 13 }}>
                            {r.appointments}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: 13 }}>
                            {BRL(r.bruto)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontSize: 13, fontWeight: 600 }}
                          >
                            {BRL(r.liquido)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Dialog: editar/cadastrar preço ── */}
      <Dialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          {editTarget?.expertise.current
            ? 'Nova versão de preço'
            : 'Cadastrar preço'}
          <Typography fontSize={12} color={C.textMuted} fontWeight={400}>
            {editTarget?.hospital_name} · {editTarget?.expertise.expertise_name}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} pt={0.5}>
            <TextField
              label="Vigente a partir de"
              type="date"
              size="small"
              value={form.effective_from}
              onChange={e =>
                setForm(f => ({ ...f, effective_from: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              helperText="A versão vale desta data em diante. Versões anteriores ficam no histórico."
            />
            <Divider textAlign="left">
              <Typography fontSize={11} fontWeight={700} color={C.textMuted}>
                DIA ÚTIL
              </Typography>
            </Divider>
            <Stack direction="row" gap={1.5}>
              <TextField
                label="Bruto (DU)"
                type="number"
                size="small"
                fullWidth
                value={form.total_price}
                onChange={e =>
                  setForm(f => ({ ...f, total_price: e.target.value }))
                }
              />
              <TextField
                label="Líquido (DU)"
                type="number"
                size="small"
                fullWidth
                value={form.doctor_price}
                onChange={e =>
                  setForm(f => ({ ...f, doctor_price: e.target.value }))
                }
              />
            </Stack>
            <Divider textAlign="left">
              <Typography fontSize={11} fontWeight={700} color={C.textMuted}>
                FIM DE SEMANA
              </Typography>
            </Divider>
            <Stack direction="row" gap={1.5}>
              <TextField
                label="Bruto (FDS)"
                type="number"
                size="small"
                fullWidth
                value={form.total_fds_price}
                onChange={e =>
                  setForm(f => ({ ...f, total_fds_price: e.target.value }))
                }
              />
              <TextField
                label="Líquido (FDS)"
                type="number"
                size="small"
                fullWidth
                value={form.doctor_fds_price}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    doctor_fds_price: e.target.value,
                  }))
                }
              />
            </Stack>
            <Divider textAlign="left">
              <Typography fontSize={11} fontWeight={700} color={C.textMuted}>
                MENSALISTA (opcional)
              </Typography>
            </Divider>
            <Stack direction="row" gap={1.5}>
              <TextField
                label="Bruto mensal"
                type="number"
                size="small"
                fullWidth
                value={form.monthly_total_price}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    monthly_total_price: e.target.value,
                  }))
                }
              />
              <TextField
                label="Líquido mensal"
                type="number"
                size="small"
                fullWidth
                value={form.monthly_doctor_price}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    monthly_doctor_price: e.target.value,
                  }))
                }
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditTarget(null)}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: 'none' }}
          >
            {saving ? 'Salvando...' : 'Salvar versão'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: histórico de versões ── */}
      <Dialog
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          Histórico de preços
          <Typography fontSize={12} color={C.textMuted} fontWeight={400}>
            {historyTarget?.expertise.expertise_name}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {loadingHistory ? (
            <Skeleton variant="rounded" height={120} />
          ) : history.length === 0 ? (
            <Typography color={C.textMuted} fontSize={13}>
              Nenhuma versão cadastrada.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    VIGENTE DESDE
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    BRUTO DU / FDS
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    LÍQUIDO DU / FDS
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    CRIADO EM
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((v, i) => (
                  <TableRow
                    key={v.id}
                    sx={{ bgcolor: i === 0 ? C.greenSoft : undefined }}
                  >
                    <TableCell sx={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400 }}>
                      {new Date(v.effective_from).toLocaleDateString('pt-BR')}
                      {i === 0 && (
                        <Chip
                          size="small"
                          label="vigente"
                          sx={{
                            ml: 1,
                            height: 18,
                            fontSize: 10,
                            bgcolor: C.green,
                            color: '#fff',
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {BRL(v.total_price)} / {BRL(v.total_fds_price)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {BRL(v.doctor_price)} / {BRL(v.doctor_fds_price)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: C.textMuted }}>
                      {new Date(v.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setHistoryTarget(null)}
            sx={{ textTransform: 'none' }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </PrivateLayout>
  );
}
