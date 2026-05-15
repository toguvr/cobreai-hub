import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';
import type { HospitalDetail, AppointmentSummary } from '../../dtos';

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const EXPERTISE_PALETTE = [
  { bg: '#E3F2FD', fg: '#1565C0', border: '#1976D2' },
  { bg: '#F3E5F5', fg: '#6A1B9A', border: '#8E24AA' },
  { bg: '#E8F5E9', fg: '#2E7D32', border: '#43A047' },
  { bg: '#FFF3E0', fg: '#E65100', border: '#FB8C00' },
  { bg: '#FCE4EC', fg: '#AD1457', border: '#D81B60' },
  { bg: '#E0F7FA', fg: '#00838F', border: '#00ACC1' },
  { bg: '#EFEBE9', fg: '#4E342E', border: '#6D4C41' },
  { bg: '#ECEFF1', fg: '#37474F', border: '#546E7A' },
  { bg: '#F1F8E9', fg: '#558B2F', border: '#7CB342' },
  { bg: '#EDE7F6', fg: '#4527A0', border: '#5E35B1' },
];

function expertiseColor(name?: string | null) {
  if (!name) return { bg: '#FEEBC8', fg: '#9C4221', border: '#ED8936' };
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return EXPERTISE_PALETTE[Math.abs(h) % EXPERTISE_PALETTE.length];
}

function hourLabel(dateISO: string) {
  return new Date(dateISO).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Constrói a grade do mês (semanas começando no domingo)
function buildMonthGrid(monthKey: string): Date[] {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = [];
  for (
    let d = new Date(gridStart);
    d <= gridEnd;
    d.setDate(d.getDate() + 1)
  ) {
    days.push(new Date(d));
  }
  return days;
}

function dateKey(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

// 7 dias da semana (domingo→sábado) que contém a data informada
function buildWeekGrid(d: Date): Date[] {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}


function KPICard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e8eef2', borderRadius: 3, flex: 1 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography fontSize={11} color="text.secondary" fontWeight={500} mb={0.5}>
            {label}
          </Typography>
          <Typography fontSize={20} fontWeight={700}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

export default function HospitalDetail() {
  const { id: hospital_id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { current } = useEnterprise();

  const [data, setData] = useState<HospitalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  // Escala: visão mês (grade) ou semana (drill-down ao clicar num dia)
  const [scheduleView, setScheduleView] = useState<'month' | 'week'>('month');
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());

  const load = async (selectedMonth: string) => {
    if (!current?.id || !hospital_id) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/enterprise/${current.id}/hospitals/${hospital_id}/detail`,
        { params: { month: selectedMonth } },
      );
      setData(res.data);
    } catch {
      toast.error('Erro ao carregar detalhes do hospital.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(month);
  }, [current?.id, hospital_id, month]);

  // Calendário: grade do mês + jornadas agrupadas por dia.
  // IMPORTANTE: hooks antes de qualquer return condicional (Rules of Hooks).
  const monthGrid = useMemo(() => buildMonthGrid(month), [month]);
  const weekGrid = useMemo(() => buildWeekGrid(weekAnchor), [weekAnchor]);
  const apptsByDay = useMemo(() => {
    const map = new Map<string, AppointmentSummary[]>();
    (data?.month_appointments ?? []).forEach(a => {
      const key = dateKey(a.date);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    });
    // ordena cada dia por horário
    map.forEach(list =>
      list.sort(
        (x, y) => new Date(x.date).getTime() - new Date(y.date).getTime(),
      ),
    );
    return map;
  }, [data]);

  // Trocar de mês volta para a visão de grade
  useEffect(() => {
    setScheduleView('month');
  }, [month]);

  const openWeek = (day: Date) => {
    setWeekAnchor(day);
    setScheduleView('week');
  };

  if (loading && !data) {
    return (
      <PrivateLayout>
        <Box display="flex" justifyContent="center" pt={8}>
          <CircularProgress />
        </Box>
      </PrivateLayout>
    );
  }

  const hospital = data?.hospital;
  const kpis = data?.kpis;
  const [refYear, refMonth] = month.split('-').map(Number);

  return (
    <PrivateLayout>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Box
          sx={{ cursor: 'pointer', color: 'text.secondary', display: 'flex' }}
          onClick={() => navigate(-1)}
        >
          <ArrowBackIcon fontSize="small" />
        </Box>
        <Avatar
          src={hospital?.logo_url || undefined}
          variant="rounded"
          sx={{ width: 40, height: 40, bgcolor: '#e8f5ee' }}
        >
          <LocalHospitalIcon sx={{ color: '#1a6b4a', fontSize: 20 }} />
        </Avatar>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            {hospital?.name ?? '—'}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            {[hospital?.cidade, hospital?.uf].filter(Boolean).join(' – ')}
          </Typography>
        </Box>

        {/* Seletor de mês */}
        <TextField
          type="month"
          size="small"
          value={month}
          onChange={e => setMonth(e.target.value)}
          sx={{ width: 150 }}
        />
      </Box>

      {/* KPIs */}
      {kpis && (
        <Box display="flex" gap={2} mb={3} flexWrap="wrap">
          <KPICard
            label="Plantões no mês"
            value={kpis.total_appointments_month.toLocaleString('pt-BR')}
            icon={<EventNoteIcon sx={{ color: '#2196f3', fontSize: 20 }} />}
            color="#e3f2fd"
          />
          <KPICard
            label="Total de plantões"
            value={kpis.total_appointments_all.toLocaleString('pt-BR')}
            icon={<EventNoteIcon sx={{ color: '#7c3aed', fontSize: 20 }} />}
            color="#f3e8ff"
          />
          <KPICard
            label="Médicos vinculados"
            value={kpis.active_doctors}
            icon={<PeopleIcon sx={{ color: '#1a6b4a', fontSize: 20 }} />}
            color="#e8f5ee"
          />
          <KPICard
            label="Receita no mês"
            value={fmt(kpis.income_month)}
            icon={<TrendingUpIcon sx={{ color: '#1a6b4a', fontSize: 20 }} />}
            color="#e8f5ee"
          />
          <KPICard
            label="Custo no mês"
            value={fmt(kpis.outcome_month)}
            icon={<TrendingDownIcon sx={{ color: '#dc2626', fontSize: 20 }} />}
            color="#fff5f5"
          />
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid #e8eef2' }}
      >
        <Tab label="Escala" sx={{ fontSize: 13, textTransform: 'none' }} />
        <Tab label="Médicos" sx={{ fontSize: 13, textTransform: 'none' }} />
        <Tab label="Informações" sx={{ fontSize: 13, textTransform: 'none' }} />
      </Tabs>

      {/* Tab 0 — Escala em calendário */}
      {tab === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid #e8eef2', borderRadius: 2, overflow: 'hidden' }}
        >
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box>
              {/* Barra: visão semana mostra botão de voltar + intervalo */}
              {scheduleView === 'week' && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid #e8eef2',
                  }}
                >
                  <Button
                    size="small"
                    startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                    onClick={() => setScheduleView('month')}
                    sx={{ textTransform: 'none', color: '#1a6b4a' }}
                  >
                    Voltar ao mês
                  </Button>
                  <Typography fontSize={13} fontWeight={600} color="#1e293b">
                    Semana de {weekGrid[0].toLocaleDateString('pt-BR')} a{' '}
                    {weekGrid[6].toLocaleDateString('pt-BR')}
                  </Typography>
                </Box>
              )}

              {/* Cabeçalho dos dias da semana */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  bgcolor: '#f8fafc',
                }}
              >
                {(scheduleView === 'month' ? DAY_LABELS : weekGrid).map(
                  (d, i) => (
                    <Box
                      key={typeof d === 'string' ? d : dateKey(d)}
                      sx={{
                        py: 1,
                        textAlign: 'center',
                        borderRight: '1px solid #e8eef2',
                        '&:last-of-type': { borderRight: 0 },
                      }}
                    >
                      <Typography
                        fontSize={11}
                        fontWeight={700}
                        color="#475569"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        {typeof d === 'string'
                          ? d
                          : `${DAY_LABELS[i]} ${d.getDate()}`}
                      </Typography>
                    </Box>
                  ),
                )}
              </Box>

              {/* ── Visão MÊS ── */}
              {scheduleView === 'month' && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                  }}
                >
                  {monthGrid.map(day => {
                    const key = dateKey(day);
                    const list = apptsByDay.get(key) ?? [];
                    const inMonth =
                      day.getFullYear() === refYear &&
                      day.getMonth() + 1 === refMonth;
                    const isToday = key === dateKey(new Date());
                    return (
                      <Box
                        key={key}
                        onClick={() => openWeek(day)}
                        sx={{
                          minHeight: 116,
                          borderRight: '1px solid #e8eef2',
                          borderBottom: '1px solid #e8eef2',
                          p: 0.75,
                          bgcolor: inMonth ? '#fff' : '#fafbfc',
                          opacity: inMonth ? 1 : 0.55,
                          display: 'flex',
                          flexDirection: 'column',
                          minWidth: 0,
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                          '&:hover': { bgcolor: '#f1f8f4' },
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            mb: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: isToday ? '#1a6b4a' : 'transparent',
                              color: isToday ? '#fff' : '#1e293b',
                              fontWeight: isToday ? 700 : 500,
                              fontSize: 12,
                            }}
                          >
                            {day.getDate()}
                          </Box>
                          {list.length > 0 && (
                            <Typography
                              fontSize={10}
                              fontWeight={600}
                              color="text.secondary"
                            >
                              {list.length}
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {list.slice(0, 4).map(a => {
                            const c = expertiseColor(a.expertise_name);
                            const open = !a.doctor_name;
                            return (
                              <Tooltip
                                key={a.id}
                                title={`${hourLabel(a.date)} · ${
                                  a.expertise_name ?? 'Especialidade'
                                } · ${a.doctor_name ?? 'Em aberto'} · ${
                                  a.duration
                                }h`}
                              >
                                <Box
                                  sx={{
                                    bgcolor: open ? '#FEEBC8' : c.bg,
                                    borderLeft: `3px solid ${
                                      open ? '#ED8936' : c.border
                                    }`,
                                    borderRadius: 0.5,
                                    px: 0.5,
                                    py: 0.25,
                                    mb: 0.25,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <Typography
                                    fontSize={10}
                                    fontWeight={600}
                                    color={open ? '#9C4221' : c.fg}
                                    noWrap
                                  >
                                    {hourLabel(a.date)}{' '}
                                    {a.doctor_name ?? 'Em aberto'}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            );
                          })}
                          {list.length > 4 && (
                            <Typography
                              fontSize={10}
                              color="#1a6b4a"
                              fontWeight={600}
                              sx={{ pl: 0.5 }}
                            >
                              + {list.length - 4} mais
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* ── Visão SEMANA: colunas com todos os nomes da escala ── */}
              {scheduleView === 'week' && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    minHeight: 360,
                  }}
                >
                  {weekGrid.map(day => {
                    const key = dateKey(day);
                    const list = apptsByDay.get(key) ?? [];
                    const isToday = key === dateKey(new Date());
                    return (
                      <Box
                        key={key}
                        sx={{
                          borderRight: '1px solid #e8eef2',
                          '&:last-of-type': { borderRight: 0 },
                          p: 0.75,
                          minWidth: 0,
                          bgcolor: isToday ? '#f1f8f4' : '#fff',
                        }}
                      >
                        {list.length === 0 ? (
                          <Typography
                            fontSize={11}
                            color="text.disabled"
                            sx={{ textAlign: 'center', mt: 2 }}
                          >
                            —
                          </Typography>
                        ) : (
                          list.map(a => {
                            const c = expertiseColor(a.expertise_name);
                            const open = !a.doctor_name;
                            return (
                              <Box
                                key={a.id}
                                sx={{
                                  bgcolor: open ? '#FEEBC8' : c.bg,
                                  borderLeft: `3px solid ${
                                    open ? '#ED8936' : c.border
                                  }`,
                                  borderRadius: 0.75,
                                  px: 0.75,
                                  py: 0.5,
                                  mb: 0.5,
                                }}
                              >
                                <Typography
                                  fontSize={11}
                                  fontWeight={700}
                                  color={open ? '#9C4221' : c.fg}
                                >
                                  {hourLabel(a.date)}
                                  {' – '}
                                  {hourLabel(
                                    new Date(
                                      new Date(a.date).getTime() +
                                        a.duration * 3600000,
                                    ).toISOString(),
                                  )}
                                </Typography>
                                <Typography
                                  fontSize={12}
                                  fontWeight={600}
                                  color={open ? '#9C4221' : '#1e293b'}
                                  sx={{
                                    fontStyle: open ? 'italic' : 'normal',
                                  }}
                                >
                                  {a.doctor_name ?? 'Em aberto'}
                                </Typography>
                                <Typography
                                  fontSize={10}
                                  color={open ? '#9C4221' : c.fg}
                                  noWrap
                                >
                                  {a.expertise_name ?? 'Especialidade'} ·{' '}
                                  {a.duration}h
                                </Typography>
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Tab 1 — Médicos */}
      {tab === 1 && (
        <Paper elevation={0} sx={{ border: '1px solid #e8eef2' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                {['', 'Nome', 'E-mail', 'Tipo'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: '#475569' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!data?.doctors.length ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>
                    Nenhum médico vinculado
                  </TableCell>
                </TableRow>
              ) : (
                data.doctors.map(d => (
                  <TableRow key={d.id} hover>
                    <TableCell sx={{ width: 44 }}>
                      <Avatar src={d.avatar_url || undefined} sx={{ width: 30, height: 30, fontSize: 12 }}>
                        {d.name[0]}
                      </Avatar>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>{d.name}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{d.email}</TableCell>
                    <TableCell>
                      {d.admin ? (
                        <Tooltip title="Administrador">
                          <Chip
                            icon={<AdminPanelSettingsIcon sx={{ fontSize: '14px !important' }} />}
                            label="Admin"
                            size="small"
                            sx={{ fontSize: 10, bgcolor: '#e8f5ee', color: '#1a6b4a', fontWeight: 600 }}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          label="Médico"
                          size="small"
                          sx={{ fontSize: 10, bgcolor: '#f1f5f9', color: '#475569' }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Tab 2 — Informações */}
      {tab === 2 && hospital && (
        <Paper elevation={0} sx={{ border: '1px solid #e8eef2', p: 3 }}>
          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            gap={2}
          >
            {[
              { label: 'Mín. horas', value: hospital.min_hours ? `${hospital.min_hours}h` : '—' },
              { label: 'Tolerância', value: `${hospital.min_tolerance}min` },
              { label: 'CEP', value: hospital.cep || '—' },
              { label: 'Endereço', value: [hospital.logradouro, hospital.numero, hospital.complemento].filter(Boolean).join(', ') || '—' },
              { label: 'Bairro', value: hospital.bairro || '—' },
              { label: 'Cidade / UF', value: [hospital.cidade, hospital.uf].filter(Boolean).join(' / ') || '—' },
              { label: 'Latitude', value: hospital.latitude || '—' },
              { label: 'Longitude', value: hospital.longitude || '—' },
            ].map(item => (
              <Box key={item.label}>
                <Typography fontSize={11} color="text.secondary" fontWeight={500}>
                  {item.label}
                </Typography>
                <Typography fontSize={14} fontWeight={500} mt={0.3}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </PrivateLayout>
  );
}
