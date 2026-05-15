import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RemoveIcon from '@mui/icons-material/Remove';
import { LineChart } from '@mui/x-charts/LineChart';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';
import api from '../../services/api';
import type { EnterpriseHub, HospitalSummary } from '../../dtos';

// ─── Tokens (universais) ─────────────────────────────────────────────────────

const C = {
  red: '#dc2626',
  redSoft: '#fff5f5',
  amber: '#b45309',
  amberSoft: '#fef3c7',
  border: '#e8eef2',
  textMuted: '#64748b',
  surface: '#ffffff',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const BRL = (v: number, compact = true) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: compact ? 0 : 2,
  });

const MONTHS_PT_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];
const MONTHS_PT_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string, long = false) => {
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return long ? `${MONTHS_PT_LONG[idx]} ${y}` : `${MONTHS_PT_SHORT[idx]}/${y.slice(2)}`;
};

const addMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
};

/** Variação percentual com tratamento para divisão por zero. */
const pctDelta = (current: number, prev: number): number | null => {
  if (prev === 0) {
    if (current === 0) return 0;
    return null; // não há base para comparar
  }
  return ((current - prev) / Math.abs(prev)) * 100;
};

// ─── DeltaBadge: variação % com seta ────────────────────────────────────────

function DeltaBadge({
  delta,
  positiveIsGood = true,
  size = 'sm',
}: {
  delta: number | null;
  positiveIsGood?: boolean;
  size?: 'sm' | 'md';
}) {
  const brand = useBrand();
  if (delta === null) {
    return (
      <Chip
        size="small"
        icon={<RemoveIcon sx={{ fontSize: 14 }} />}
        label="sem base"
        sx={{
          height: size === 'md' ? 24 : 20,
          fontSize: size === 'md' ? 12 : 11,
          bgcolor: '#f1f5f9',
          color: C.textMuted,
          '& .MuiChip-icon': { ml: 0.5, color: C.textMuted },
        }}
      />
    );
  }

  const isUp = delta >= 0;
  const isGood = positiveIsGood ? isUp : !isUp;
  const fg = isGood ? brand.primary : C.red;
  const bg = isGood ? brand.primarySoft : C.redSoft;
  const Icon = isUp ? ArrowUpwardIcon : ArrowDownwardIcon;

  return (
    <Chip
      size="small"
      icon={<Icon sx={{ fontSize: 14 }} />}
      label={`${isUp ? '+' : ''}${delta.toFixed(1)}%`}
      sx={{
        height: size === 'md' ? 26 : 20,
        fontSize: size === 'md' ? 12 : 11,
        fontWeight: 600,
        bgcolor: bg,
        color: fg,
        '& .MuiChip-icon': { ml: 0.5, color: fg },
      }}
    />
  );
}

// ─── Hero card ───────────────────────────────────────────────────────────────

function HeroBalance({
  balance,
  income,
  outcome,
  prevBalance,
  marginPct,
  prevMarginPct,
  activeDoctors,
  prevActiveDoctors,
}: {
  balance: number;
  income: number;
  outcome: number;
  prevBalance: number;
  marginPct: number | null;
  prevMarginPct: number | null;
  activeDoctors: number;
  prevActiveDoctors: number;
}) {
  const brand = useBrand();
  const balanceDelta = pctDelta(balance, prevBalance);
  const isPositive = balance >= 0;
  const accent = isPositive ? brand.primary : C.red;

  const marginDelta =
    marginPct !== null && prevMarginPct !== null
      ? marginPct - prevMarginPct
      : null;

  const doctorsDelta = pctDelta(activeDoctors, prevActiveDoctors);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        border: `1px solid ${C.border}`,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${C.surface} 0%, ${isPositive ? brand.primarySoft : C.redSoft} 220%)`,
      }}
    >
      <Grid container spacing={3} alignItems="center">
        {/* Bloco principal: Saldo */}
        <Grid item xs={12} md={6}>
          <Typography fontSize={11} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6}>
            Saldo do mês
          </Typography>
          <Box display="flex" alignItems="baseline" gap={1.5} mt={0.5} flexWrap="wrap">
            <Typography fontSize={{ xs: 28, md: 36 }} fontWeight={800} color={accent} lineHeight={1.1}>
              {isPositive ? '+' : ''}{BRL(balance)}
            </Typography>
            <DeltaBadge delta={balanceDelta} size="md" />
          </Box>
          <Typography fontSize={12} color="text.secondary" mt={0.75}>
            Receita {BRL(income)} · Custo {BRL(outcome)}
          </Typography>
        </Grid>

        {/* Satélites */}
        <Grid item xs={6} md={3}>
          <Typography fontSize={11} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6}>
            Margem líquida
          </Typography>
          <Box display="flex" alignItems="baseline" gap={1} mt={0.5} flexWrap="wrap">
            <Typography fontSize={{ xs: 18, md: 22 }} fontWeight={700} color="text.primary">
              {marginPct === null ? '—' : `${marginPct.toFixed(1)}%`}
            </Typography>
            {marginDelta !== null && (
              <Typography
                fontSize={11}
                fontWeight={600}
                color={marginDelta >= 0 ? brand.primary : C.red}
              >
                {marginDelta >= 0 ? '+' : ''}{marginDelta.toFixed(1)} pp
              </Typography>
            )}
          </Box>
        </Grid>

        <Grid item xs={6} md={3}>
          <Typography fontSize={11} fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.6}>
            Médicos ativos
          </Typography>
          <Box display="flex" alignItems="baseline" gap={1} mt={0.5} flexWrap="wrap">
            <Typography fontSize={{ xs: 18, md: 22 }} fontWeight={700} color="text.primary">
              {activeDoctors}
            </Typography>
            <DeltaBadge delta={doctorsDelta} />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

// ─── Trend chart ────────────────────────────────────────────────────────────

function TrendChart({
  data,
  selectedMonth,
}: {
  data: EnterpriseHub['monthly_history'];
  selectedMonth: string;
}) {
  const brand = useBrand();
  const xLabels = data.map(p => monthLabel(p.month));
  const incomeSeries = data.map(p => p.income);
  const outcomeSeries = data.map(p => p.outcome);
  const balanceSeries = data.map(p => p.balance);

  const selectedIdx = data.findIndex(p => p.month === selectedMonth);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        border: `1px solid ${C.border}`,
        borderRadius: 3,
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
        <Box>
          <Typography fontSize={14} fontWeight={700}>
            Últimos 6 meses
          </Typography>
          <Typography fontSize={11} color="text.secondary">
            Receita, custo e saldo consolidados
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <LegendDot color={brand.primary} label="Receita" />
          <LegendDot color={C.red} label="Custo" />
          <LegendDot color="#1565c0" label="Saldo" />
        </Stack>
      </Box>

      <Box sx={{ width: '100%', height: 260 }}>
        <LineChart
          xAxis={[{
            data: xLabels,
            scaleType: 'point',
            tickLabelStyle: { fontSize: 11, fill: C.textMuted },
          }]}
          yAxis={[{
            valueFormatter: v => BRL(Number(v) || 0),
            tickLabelStyle: { fontSize: 11, fill: C.textMuted },
          }]}
          series={[
            {
              data: incomeSeries,
              label: 'Receita',
              color: brand.primary,
              showMark: ({ index }) => index === selectedIdx,
              area: false,
              curve: 'monotoneX',
            },
            {
              data: outcomeSeries,
              label: 'Custo',
              color: C.red,
              showMark: ({ index }) => index === selectedIdx,
              area: false,
              curve: 'monotoneX',
            },
            {
              data: balanceSeries,
              label: 'Saldo',
              color: '#1565c0',
              showMark: ({ index }) => index === selectedIdx,
              area: true,
              curve: 'monotoneX',
            },
          ]}
          margin={{ top: 16, right: 24, bottom: 28, left: 64 }}
          slotProps={{ legend: { hidden: true } }}
          sx={{
            '& .MuiAreaElement-series-2': { fill: 'url(#balanceGradient)' },
          }}
        >
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1565c0" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#1565c0" stopOpacity={0} />
            </linearGradient>
          </defs>
        </LineChart>
      </Box>
    </Paper>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box display="flex" alignItems="center" gap={0.75}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography fontSize={11} color="text.secondary">{label}</Typography>
    </Box>
  );
}

// ─── Hospital card ──────────────────────────────────────────────────────────

type HospitalSignal = 'critical' | 'warning' | 'inactive' | 'ok';

function detectSignal(h: HospitalSummary): { signal: HospitalSignal; balanceDelta: number | null } {
  const balance = h.month_income - h.month_outcome;
  const prevBalance = h.prev_month_income - h.prev_month_outcome;
  const delta = pctDelta(balance, prevBalance);

  if (h.month_appointments === 0) return { signal: 'inactive', balanceDelta: delta };
  if (balance < 0) return { signal: 'critical', balanceDelta: delta };
  if (delta !== null && delta < -15) return { signal: 'warning', balanceDelta: delta };
  return { signal: 'ok', balanceDelta: delta };
}

const SIGNAL_RANK: Record<HospitalSignal, number> = {
  critical: 0,
  warning: 1,
  inactive: 2,
  ok: 3,
};

function HospitalCard({ hospital }: { hospital: HospitalSummary }) {
  const navigate = useNavigate();
  const brand = useBrand();
  const balance = hospital.month_income - hospital.month_outcome;
  const isPositive = balance >= 0;
  const accent = isPositive ? brand.primary : C.red;

  const { signal, balanceDelta } = detectSignal(hospital);
  const sparkData = hospital.history_3m.map(p => p.balance);

  const badge = (() => {
    if (signal === 'critical')
      return { label: 'Saldo negativo', color: C.red, bg: C.redSoft, icon: <WarningAmberIcon sx={{ fontSize: 13 }} /> };
    if (signal === 'warning')
      return { label: 'Queda relevante', color: C.amber, bg: C.amberSoft, icon: <WarningAmberIcon sx={{ fontSize: 13 }} /> };
    if (signal === 'inactive')
      return { label: 'Sem plantões', color: C.textMuted, bg: '#f1f5f9', icon: null };
    return null;
  })();

  return (
    <Paper
      elevation={0}
      onClick={() => navigate(`/hospitais/${hospital.id}`)}
      sx={{
        p: 2,
        border: `1px solid ${signal === 'critical' ? C.red : signal === 'warning' ? C.amber : C.border}`,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        },
      }}
    >
      {/* Header: avatar + nome */}
      <Box display="flex" alignItems="center" gap={1.5}>
        <Avatar
          src={hospital.logo_url ?? undefined}
          variant="rounded"
          sx={{ width: 40, height: 40, bgcolor: brand.primarySoft, flexShrink: 0 }}
        >
          <LocalHospitalIcon sx={{ color: brand.primary, fontSize: 20 }} />
        </Avatar>
        <Box flex={1} overflow="hidden">
          <Typography fontSize={14} fontWeight={600} noWrap>
            {hospital.name}
          </Typography>
          <Typography fontSize={11} color="text.secondary" noWrap>
            {[hospital.cidade, hospital.uf].filter(Boolean).join(' – ') || '—'}
          </Typography>
        </Box>
      </Box>

      {/* Saldo + delta */}
      <Box>
        <Box display="flex" alignItems="baseline" gap={1} flexWrap="wrap">
          <Typography fontSize={20} fontWeight={700} color={accent} lineHeight={1.1}>
            {isPositive ? '+' : ''}{BRL(balance)}
          </Typography>
          <DeltaBadge delta={balanceDelta} />
        </Box>
        <Typography fontSize={11} color="text.secondary" mt={0.25}>
          saldo do mês
        </Typography>
      </Box>

      {/* Sparkline 3 meses */}
      <Box sx={{ width: '100%', height: 36, mt: -0.5 }}>
        <SparkLineChart
          data={sparkData}
          height={36}
          curve="monotoneX"
          area
          colors={[accent]}
          showHighlight
          showTooltip
          xAxis={{
            data: hospital.history_3m.map(p => monthLabel(p.month)),
            scaleType: 'point',
          }}
          valueFormatter={v => BRL(Number(v) || 0)}
        />
      </Box>

      {/* Footer: plantões + badge */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mt="auto" pt={0.5}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <EventNoteIcon sx={{ fontSize: 14, color: C.textMuted }} />
          <Typography fontSize={12} color="text.secondary">
            {hospital.month_appointments} plantões
          </Typography>
        </Box>
        {badge && (
          <Chip
            size="small"
            icon={badge.icon ?? undefined}
            label={badge.label}
            sx={{
              height: 22,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: badge.bg,
              color: badge.color,
              '& .MuiChip-icon': { ml: 0.5, color: badge.color },
            }}
          />
        )}
      </Box>
    </Paper>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { current } = useEnterprise();
  const navigate = useNavigate();
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [hub, setHub] = useState<EnterpriseHub | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/enterprise/${current.id}/hub?month=${monthKey}`);
      setHub(res.data);
    } catch {
      toast.error('Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, [current?.id, monthKey]);

  useEffect(() => { load(); }, [load]);

  const isCurrentMonth = monthKey === toMonthKey(new Date());

  // Hospitais ordenados: alertas primeiro, depois por saldo
  const sortedHospitals = useMemo(() => {
    if (!hub) return [];
    return [...hub.hospitals].sort((a, b) => {
      const sa = detectSignal(a).signal;
      const sb = detectSignal(b).signal;
      if (sa !== sb) return SIGNAL_RANK[sa] - SIGNAL_RANK[sb];
      const balA = a.month_income - a.month_outcome;
      const balB = b.month_income - b.month_outcome;
      return balB - balA;
    });
  }, [hub]);

  const balance = hub ? hub.month_income - hub.month_outcome : 0;
  const prevBalance = hub ? hub.prev_month_income - hub.prev_month_outcome : 0;
  const marginPct = hub && hub.month_income > 0 ? (balance / hub.month_income) * 100 : null;
  const prevMarginPct = hub && hub.prev_month_income > 0 ? (prevBalance / hub.prev_month_income) * 100 : null;

  return (
    <PrivateLayout>
      {/* Header */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2.5} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="text.primary">
            {current?.title || 'Dashboard'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visão consolidada · {monthLabel(monthKey, true)}
          </Typography>
        </Box>

        <Box
          display="flex"
          alignItems="center"
          gap={0.5}
          sx={{ border: `1px solid ${C.border}`, borderRadius: 2, p: 0.5, bgcolor: C.surface }}
        >
          <IconButton size="small" onClick={() => setMonthKey(k => addMonth(k, -1))}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Box px={1.5} minWidth={120} textAlign="center">
            <Typography fontSize={13} fontWeight={700}>
              {monthLabel(monthKey, true)}
            </Typography>
            {isCurrentMonth && (
              <Typography fontSize={9} color="text.secondary" textTransform="uppercase" letterSpacing={0.6}>
                mês atual
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setMonthKey(k => addMonth(k, 1))}
            disabled={isCurrentMonth}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {loading || !hub ? (
        <Box display="flex" justifyContent="center" pt={8}>
          <CircularProgress />
        </Box>
      ) : hub.hospitals_count === 0 ? (
        <Paper
          elevation={0}
          sx={{ p: 5, textAlign: 'center', border: `1px solid ${C.border}`, borderRadius: 3 }}
        >
          <LocalHospitalIcon sx={{ fontSize: 40, color: C.textMuted, mb: 1 }} />
          <Typography fontSize={15} fontWeight={600}>
            Nenhum hospital vinculado
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            Adicione hospitais à organização para ver dados consolidados aqui.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Aviso: faturamento incompleto se faltar preço da empresa */}
          {hub.missing_prices && hub.missing_prices.length > 0 && (
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                border: `1px solid #f59e0b`,
                borderRadius: 2,
                bgcolor: '#fffbeb',
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography fontSize={13} fontWeight={700} color="#92400e">
                  Faturamento incompleto — {hub.missing_prices.length}{' '}
                  {hub.missing_prices.length === 1
                    ? 'especialidade'
                    : 'especialidades'}{' '}
                  sem preço cadastrado
                </Typography>
                <Typography fontSize={12} color="#78350f" mt={0.5}>
                  Plantões dessas especialidades não estão no faturamento.
                  Cadastre os preços em "Preços & Fechamento".
                </Typography>
              </Box>
              <Box
                component="button"
                onClick={() => navigate('/precos')}
                sx={{
                  cursor: 'pointer',
                  border: '1px solid #f59e0b',
                  bgcolor: 'transparent',
                  color: '#92400e',
                  fontSize: 12,
                  fontWeight: 600,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  '&:hover': { bgcolor: '#fef3c7' },
                }}
              >
                Ir para preços
              </Box>
            </Box>
          )}
          {/* Zona 1 — Hero */}
          <Box mb={2.5}>
            <HeroBalance
              balance={balance}
              income={hub.month_income}
              outcome={hub.month_outcome}
              prevBalance={prevBalance}
              marginPct={marginPct}
              prevMarginPct={prevMarginPct}
              activeDoctors={hub.active_doctors}
              prevActiveDoctors={hub.prev_active_doctors}
            />
          </Box>

          {/* Zona 2 — Tendência */}
          <Box mb={2.5}>
            <TrendChart data={hub.monthly_history} selectedMonth={monthKey} />
          </Box>

          {/* Zona 3 — Hospitais */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
            <Typography fontSize={14} fontWeight={700}>
              Hospitais da organização
              <Typography component="span" fontSize={12} color="text.secondary" ml={1}>
                · {hub.hospitals_count}
              </Typography>
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <PeopleAltIcon sx={{ fontSize: 14, color: C.textMuted }} />
              <Typography fontSize={11} color="text.secondary">
                Alertas primeiro · ordenado por saldo
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            {sortedHospitals.map(h => (
              <Grid key={h.id} item xs={12} sm={6} md={4}>
                <HospitalCard hospital={h} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PrivateLayout>
  );
}
