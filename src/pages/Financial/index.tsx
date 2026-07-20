import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { BarChart } from '@mui/x-charts/BarChart';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';
import api from '../../services/api';
import type { FinancialData } from '../../dtos';

// ─── Tokens universais (semântica fixa: vermelho=perda, azul=neutro) ────

const C = {
  red: '#dc2626',
  redSoft: '#fff5f5',
  blue: '#1565c0',
  blueSoft: '#e3f2fd',
  border: '#e8eef2',
  borderSoft: '#f1f5f9',
  textMuted: '#64748b',
  surface: '#ffffff',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const BRL = (v: number, compact = true) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: compact ? 0 : 2,
  });

// Reduz a fonte proporcionalmente ao comprimento do texto pra evitar
// que valores tipo "R$ 12.345.678" transbordem os cards. Base é o
// tamanho pra texto curto (~10 chars); acima disso vai encolhendo.
const fitFontSize = (
  text: string,
  base: { xs: number; md: number },
): { xs: number; md: number } => {
  const len = text.length;
  if (len <= 10) return base;
  const scale = Math.max(0.55, 1 - (len - 10) * 0.06);
  return {
    xs: Math.round(base.xs * scale),
    md: Math.round(base.md * scale),
  };
};

const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
};

const addMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
};

const pctDelta = (cur: number, prev: number): number | null => {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

// ─── DeltaBadge (mesmo padrão do dash) ─────────────────────────────────────

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
          bgcolor: C.borderSoft,
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

// ─── KPI Card ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  delta,
  positiveIsGood = true,
  Icon,
  iconBg,
  iconColor,
  hero = false,
  highlight,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta: number | null;
  positiveIsGood?: boolean;
  Icon: typeof AccountBalanceIcon;
  iconBg: string;
  iconColor: string;
  hero?: boolean;
  highlight?: 'positive' | 'negative';
}) {
  const brand = useBrand();
  const valueColor =
    highlight === 'positive' ? brand.primary : highlight === 'negative' ? C.red : 'text.primary';
  return (
    <Paper
      elevation={0}
      sx={{
        p: hero ? 2.75 : 2.25,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
        height: '100%',
        background: hero
          ? `linear-gradient(135deg, ${C.surface} 0%, ${highlight === 'positive' ? brand.primarySoft : C.redSoft} 240%)`
          : C.surface,
      }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box minWidth={0} flex={1}>
          <Typography
            fontSize={11}
            fontWeight={600}
            color="text.secondary"
            textTransform="uppercase"
            letterSpacing={0.6}
          >
            {label}
          </Typography>
          <Typography
            fontSize={fitFontSize(
              value,
              hero ? { xs: 24, md: 30 } : { xs: 18, md: 22 },
            )}
            fontWeight={hero ? 800 : 700}
            color={valueColor}
            lineHeight={1.15}
            mt={0.5}
            title={value}
            sx={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </Typography>
          {sub && (
            <Box mt={0.5} fontSize={11} color="text.secondary">
              {sub}
            </Box>
          )}
        </Box>
        <Box
          sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: iconBg, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: iconColor, fontSize: 20 }} />
        </Box>
      </Box>
      <Box mt={1.25}>
        <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} size={hero ? 'md' : 'sm'} />
      </Box>
    </Paper>
  );
}

// ─── Tabela de hospitais ──────────────────────────────────────────────────

type SortKey = 'name' | 'income' | 'outcome' | 'balance' | 'margin';
type SortDir = 'asc' | 'desc';

interface RowWithMargin {
  hospital_id: string;
  hospital_name: string;
  income: number;
  outcome: number;
  balance: number;
  margin: number | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Financial() {
  const { current } = useEnterprise();
  const brand = useBrand();
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [data, setData] = useState<FinancialData | null>(null);
  const [prevData, setPrevData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const [cur, prev] = await Promise.all([
        api.get(`/enterprise/${current.id}/financial`, { params: { month: monthKey } }),
        api.get(`/enterprise/${current.id}/financial`, {
          params: { month: addMonth(monthKey, -1) },
        }),
      ]);
      setData(cur.data);
      setPrevData(prev.data);
    } catch {
      toast.error('Erro ao carregar financeiro.');
    } finally {
      setLoading(false);
    }
  }, [current?.id, monthKey]);

  useEffect(() => { load(); }, [load]);

  const isCurrentMonth = monthKey === toMonthKey(new Date());

  const balance = data ? data.totals.income - data.totals.outcome : 0;
  const prevBalance = prevData ? prevData.totals.income - prevData.totals.outcome : 0;
  const incomeDelta = data && prevData ? pctDelta(data.totals.income, prevData.totals.income) : null;
  const outcomeDelta = data && prevData ? pctDelta(data.totals.outcome, prevData.totals.outcome) : null;
  const balanceDelta = data && prevData ? pctDelta(balance, prevBalance) : null;
  const marginPct = data && data.totals.income > 0
    ? (balance / data.totals.income) * 100 : null;
  const prevMarginPct = prevData && prevData.totals.income > 0
    ? (prevBalance / prevData.totals.income) * 100 : null;
  const marginDelta = marginPct !== null && prevMarginPct !== null
    ? marginPct - prevMarginPct : null;

  const rows: RowWithMargin[] = useMemo(() => {
    if (!data) return [];
    return data.rows.map(r => {
      const bal = r.income - r.outcome;
      const margin = r.income > 0 ? (bal / r.income) * 100 : null;
      return {
        hospital_id: r.hospital_id,
        hospital_name: r.hospital_name,
        income: r.income,
        outcome: r.outcome,
        balance: bal,
        margin,
      };
    });
  }, [data]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.hospital_name.localeCompare(b.hospital_name);
      else if (sortKey === 'income') cmp = a.income - b.income;
      else if (sortKey === 'outcome') cmp = a.outcome - b.outcome;
      else if (sortKey === 'balance') cmp = a.balance - b.balance;
      else if (sortKey === 'margin') {
        const am = a.margin ?? -Infinity;
        const bm = b.margin ?? -Infinity;
        cmp = am - bm;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  // Top 8 hospitais por |saldo| para o gráfico (evita poluição)
  const topForChart = useMemo(() => {
    return [...rows]
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 8)
      .reverse(); // bar chart horizontal: maiores no topo
  }, [rows]);

  return (
    <PrivateLayout>
      {/* Header */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2.5} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Financeiro
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {current?.title} · {monthLabel(monthKey)}
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
              {monthLabel(monthKey)}
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

      {loading || !data ? (
        <>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={2.5}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={130} />
            ))}
          </Box>
          <Skeleton variant="rounded" height={320} sx={{ mb: 2.5 }} />
          <Skeleton variant="rounded" height={280} />
        </>
      ) : (
        <>
          {/* ── Aviso: faturamento incompleto se faltar preço da empresa ── */}
          {data.missing_prices && data.missing_prices.length > 0 && (
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
                  Faturamento incompleto — {data.missing_prices.length}{' '}
                  {data.missing_prices.length === 1
                    ? 'especialidade'
                    : 'especialidades'}{' '}
                  sem preço cadastrado
                </Typography>
                <Typography fontSize={12} color="#78350f" mt={0.5}>
                  Os plantões dessas especialidades não estão sendo contados
                  no faturamento. Cadastre os preços na tela "Preços &
                  Fechamento".
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => (window.location.href = '/precos')}
                sx={{
                  textTransform: 'none',
                  borderColor: '#f59e0b',
                  color: '#92400e',
                  '&:hover': { borderColor: '#d97706', bgcolor: '#fef3c7' },
                }}
              >
                Ir para preços
              </Button>
            </Box>
          )}
          {/* ── KPIs ─────────────────────────────────────────────────── */}
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={2.5}>
            <KpiCard
              label="Receita"
              value={BRL(data.totals.income)}
              delta={incomeDelta}
              Icon={TrendingUpIcon}
              iconBg={brand.primarySoft}
              iconColor={brand.primary}
            />
            <KpiCard
              label="Custo"
              value={BRL(data.totals.outcome)}
              delta={outcomeDelta}
              positiveIsGood={false}
              Icon={TrendingDownIcon}
              iconBg={C.redSoft}
              iconColor={C.red}
            />
            <KpiCard
              label="Saldo do mês"
              value={`${balance >= 0 ? '+' : ''}${BRL(balance)}`}
              delta={balanceDelta}
              Icon={AccountBalanceIcon}
              iconBg={balance >= 0 ? brand.primarySoft : C.redSoft}
              iconColor={balance >= 0 ? brand.primary : C.red}
              highlight={balance >= 0 ? 'positive' : 'negative'}
              hero
              sub={
                marginPct !== null ? (
                  <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                    margem
                    <strong>{marginPct.toFixed(1)}%</strong>
                    {marginDelta !== null && (
                      <Typography
                        component="span"
                        fontSize={11}
                        fontWeight={600}
                        color={marginDelta >= 0 ? brand.primary : C.red}
                      >
                        ({marginDelta >= 0 ? '+' : ''}{marginDelta.toFixed(1)} pp)
                      </Typography>
                    )}
                  </Box>
                ) : null
              }
            />
            <KpiCard
              label="Hospitais"
              value={String(data.rows.length)}
              delta={null}
              Icon={EventNoteIcon}
              iconBg={C.blueSoft}
              iconColor={C.blue}
              sub={`com lançamento em ${monthLabel(monthKey).toLowerCase()}`}
            />
          </Box>

          {/* ── Ranking visual ──────────────────────────────────────── */}
          {topForChart.length > 0 && (
            <Paper
              elevation={0}
              sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${C.border}`, borderRadius: 3, mb: 2.5 }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography fontSize={14} fontWeight={700}>
                    Receita vs Custo por hospital
                  </Typography>
                  <Typography fontSize={11} color="text.secondary">
                    Top {topForChart.length} hospitais por movimento financeiro · barra maior = mais relevante
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <LegendDot color={brand.primary} label="Receita" />
                  <LegendDot color={C.red} label="Custo" />
                </Stack>
              </Box>
              <Box sx={{ width: '100%', height: Math.max(140, topForChart.length * 36 + 60) }}>
                <BarChart
                  layout="horizontal"
                  yAxis={[{
                    data: topForChart.map(r => r.hospital_name),
                    scaleType: 'band',
                    tickLabelStyle: { fontSize: 11, fill: C.textMuted },
                  }]}
                  xAxis={[{
                    valueFormatter: v => BRL(Number(v) || 0),
                    tickLabelStyle: { fontSize: 11, fill: C.textMuted },
                  }]}
                  series={[
                    {
                      data: topForChart.map(r => r.income),
                      label: 'Receita',
                      color: brand.primary,
                    },
                    {
                      data: topForChart.map(r => r.outcome),
                      label: 'Custo',
                      color: C.red,
                    },
                  ]}
                  margin={{ top: 8, right: 16, bottom: 36, left: 140 }}
                  slotProps={{ legend: { hidden: true } }}
                />
              </Box>
            </Paper>
          )}

          {/* ── Tabela detalhada ────────────────────────────────────── */}
          <Paper
            elevation={0}
            sx={{ border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" p={2} pb={1.5}>
              <Typography fontSize={14} fontWeight={700}>
                Detalhamento por hospital
              </Typography>
              <Typography fontSize={11} color="text.secondary">
                {sortedRows.length} {sortedRows.length === 1 ? 'linha' : 'linhas'}
              </Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={headSx}>
                      <TableSortLabel
                        active={sortKey === 'name'}
                        direction={sortKey === 'name' ? sortDir : 'asc'}
                        onClick={() => handleSort('name')}
                      >
                        Hospital
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      <TableSortLabel
                        active={sortKey === 'income'}
                        direction={sortKey === 'income' ? sortDir : 'desc'}
                        onClick={() => handleSort('income')}
                      >
                        Receita
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      <TableSortLabel
                        active={sortKey === 'outcome'}
                        direction={sortKey === 'outcome' ? sortDir : 'desc'}
                        onClick={() => handleSort('outcome')}
                      >
                        Custo
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      <TableSortLabel
                        active={sortKey === 'balance'}
                        direction={sortKey === 'balance' ? sortDir : 'desc'}
                        onClick={() => handleSort('balance')}
                      >
                        Saldo
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      <TableSortLabel
                        active={sortKey === 'margin'}
                        direction={sortKey === 'margin' ? sortDir : 'desc'}
                        onClick={() => handleSort('margin')}
                      >
                        Margem
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        Sem lançamentos para o período selecionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRows.map(row => {
                      const positive = row.balance >= 0;
                      return (
                        <TableRow
                          key={row.hospital_id}
                          hover
                          sx={{ '&:last-of-type td': { borderBottom: 0 } }}
                        >
                          <TableCell sx={{ fontWeight: 500, fontSize: 13 }}>
                            {row.hospital_name}
                          </TableCell>
                          <TableCell align="right" sx={{ color: brand.primary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            {BRL(row.income, false)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: C.red, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                            {BRL(row.outcome, false)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 700,
                              color: positive ? brand.primary : C.red,
                              fontSize: 13,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {positive ? '+' : ''}{BRL(row.balance, false)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: 13, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                            {row.margin === null ? '—' : `${row.margin.toFixed(1)}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {sortedRows.length > 0 && (
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>TOTAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: brand.primary, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {BRL(data.totals.income, false)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: C.red, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {BRL(data.totals.outcome, false)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 800,
                          color: balance >= 0 ? brand.primary : C.red,
                          fontSize: 14,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {balance >= 0 ? '+' : ''}{BRL(balance, false)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {marginPct === null ? '—' : `${marginPct.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </>
      )}
    </PrivateLayout>
  );
}

const headSx = {
  fontWeight: 700,
  fontSize: 11,
  color: C.textMuted,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box display="flex" alignItems="center" gap={0.75}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography fontSize={11} color="text.secondary">{label}</Typography>
    </Box>
  );
}
