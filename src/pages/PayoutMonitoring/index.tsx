import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SendIcon from '@mui/icons-material/Send';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';
import type {
  EnterprisePriceList,
  MonthlyPayoutStatus,
  PayoutListItem,
  PayoutListResponse,
} from '../../dtos';
import PayoutDetailDialog from './PayoutDetailDialog';

const C = {
  border: '#e8eef2',
  borderSoft: '#f1f5f9',
  textMuted: '#64748b',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  green: '#15803d',
  greenSoft: '#f0fdf4',
  red: '#b91c1c',
  redSoft: '#fef2f2',
  blue: '#1d4ed8',
  blueSoft: '#eff6ff',
  purple: '#7c3aed',
  purpleSoft: '#f5f3ff',
};

const STATUS: Array<{
  key: MonthlyPayoutStatus;
  label: string;
  color: string;
  bg: string;
}> = [
  {
    key: 'published',
    label: 'Fechamento publicado',
    color: C.textMuted,
    bg: C.borderSoft,
  },
  { key: 'nf_requested', label: 'NF-e solicitada', color: C.blue, bg: C.blueSoft },
  {
    key: 'nf_received',
    label: 'NF-e recebida',
    color: C.purple,
    bg: C.purpleSoft,
  },
  {
    key: 'nf_rejected',
    label: 'NF-e rejeitada',
    color: C.red,
    bg: C.redSoft,
  },
  {
    key: 'nf_approved',
    label: 'NF-e aprovada',
    color: C.amber,
    bg: C.amberSoft,
  },
  { key: 'paid', label: 'Pago', color: C.green, bg: C.greenSoft },
];

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
const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};
const addMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toMonthKey(d);
};

export default function PayoutMonitoring() {
  const { current } = useEnterprise();
  const [month, setMonth] = useState(toMonthKey(new Date()));
  const [statusFilter, setStatusFilter] =
    useState<MonthlyPayoutStatus | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [data, setData] = useState<PayoutListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [requesting, setRequesting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { month };
      if (statusFilter) params.status = statusFilter;
      if (hospitalId) params.hospital_id = hospitalId;
      if (q.trim()) params.q = q.trim();
      const res = await api.get<PayoutListResponse>(
        `/enterprise/${current.id}/payouts`,
        { params },
      );
      setData(res.data);
      // Remove seleções que sumiram da lista atual.
      const validIds = new Set(res.data.items.map(i => i.id));
      setSelectedIds(prev => new Set([...prev].filter(id => validIds.has(id))));
    } catch {
      toast.error('Falha ao carregar monitoramento.');
    } finally {
      setLoading(false);
    }
  }, [current?.id, month, statusFilter, hospitalId, q]);

  useEffect(() => {
    load();
  }, [load]);

  // Popula filtro de hospital do priceList (mesma fonte usada em /precos)
  useEffect(() => {
    if (!current?.id) return;
    api
      .get<EnterprisePriceList>(`/enterprise/${current.id}/prices`)
      .then(res => {
        setHospitals(
          (res.data?.hospitals ?? [])
            .map(g => ({
              id: g.hospital_id,
              name: g.hospital_name ?? '(sem nome)',
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setHospitals([]));
  }, [current?.id]);

  const selectableIds = useMemo(
    () =>
      (data?.items ?? [])
        .filter(
          i => i.status === 'published' || i.status === 'nf_rejected',
        )
        .map(i => i.id),
    [data?.items],
  );

  const toggleAll = () => {
    setSelectedIds(prev => {
      if (prev.size === selectableIds.length && selectableIds.length > 0) {
        return new Set();
      }
      return new Set(selectableIds);
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requestNF = async () => {
    if (!current?.id || selectedIds.size === 0) return;
    setRequesting(true);
    try {
      const res = await api.post<{
        results: Array<{
          payout_id: string;
          status: string;
          emails?: string[];
          error?: string;
        }>;
      }>(`/enterprise/${current.id}/payouts/request-nf`, {
        payout_ids: Array.from(selectedIds),
      });
      const sent = res.data.results.filter(r => r.status === 'sent').length;
      const noRec = res.data.results.filter(r => r.status === 'no_recipient').length;
      const invalid = res.data.results.filter(r => r.status === 'invalid_status').length;
      const errored = res.data.results.filter(r => r.status === 'error').length;
      let msg = `NF-e solicitada pra ${sent} médico(s).`;
      if (noRec > 0) msg += ` ${noRec} sem e-mail cadastrado.`;
      if (invalid > 0) msg += ` ${invalid} não estavam no status correto.`;
      if (errored > 0) msg += ` ${errored} falhou.`;
      if (sent > 0) toast.success(msg);
      else toast.warning(msg);
      setSelectedIds(new Set());
      load();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Falha ao solicitar NF-e.',
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <PrivateLayout>
      <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Monitoramento
            </Typography>
            <Typography color={C.textMuted} fontSize={13}>
              Acompanhe cada médico da conferência ao pagamento.
            </Typography>
          </Box>

          <Stack direction="row" gap={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setMonth(addMonth(month, -1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography
              fontWeight={600}
              sx={{ minWidth: 150, textAlign: 'center' }}
            >
              {monthLabel(month)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setMonth(addMonth(month, 1))}
            >
              <ChevronRightIcon />
            </IconButton>
            {loading && <CircularProgress size={16} />}
            <Tooltip title="Recarregar">
              <IconButton size="small" onClick={load}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* KPIs por etapa — clicáveis pra filtrar */}
        <Stack direction="row" gap={1.5} flexWrap="wrap" mb={2}>
          {STATUS.map(s => {
            const count = data?.totals_by_status[s.key] ?? 0;
            const isActive = statusFilter === s.key;
            return (
              <Paper
                key={s.key}
                onClick={() =>
                  setStatusFilter(prev => (prev === s.key ? null : s.key))
                }
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 150,
                  border: `1px solid ${isActive ? s.color : C.border}`,
                  borderWidth: isActive ? 2 : 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: isActive ? s.bg : undefined,
                  transition: 'all 0.15s',
                }}
              >
                <Typography fontSize={10} color={s.color} fontWeight={700}>
                  {s.label.toUpperCase()}
                </Typography>
                <Typography fontSize={22} fontWeight={700} color={s.color}>
                  {count}
                </Typography>
              </Paper>
            );
          })}
        </Stack>

        {/* Filtros */}
        <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
          <Autocomplete
            size="small"
            options={hospitals}
            value={hospitals.find(h => h.id === hospitalId) ?? null}
            onChange={(_, v) => setHospitalId(v?.id ?? null)}
            getOptionLabel={o => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ minWidth: 240 }}
            renderInput={p => (
              <TextField {...p} label="Filtrar por hospital" />
            )}
          />
          <TextField
            size="small"
            label="Buscar médico (nome, e-mail, CRM)"
            value={q}
            onChange={e => setQ(e.target.value)}
            sx={{ flex: 1, minWidth: 240 }}
          />
          {(statusFilter || hospitalId || q) && (
            <Button
              size="small"
              onClick={() => {
                setStatusFilter(null);
                setHospitalId(null);
                setQ('');
              }}
              sx={{ textTransform: 'none' }}
            >
              Limpar filtros
            </Button>
          )}
        </Stack>

        {selectedIds.size > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2, alignItems: 'center' }}
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={
                  requesting ? <CircularProgress size={14} /> : <SendIcon />
                }
                onClick={requestNF}
                disabled={requesting}
                sx={{ textTransform: 'none' }}
              >
                Solicitar NF-e ({selectedIds.size})
              </Button>
            }
          >
            {selectedIds.size} fechamento(s) selecionado(s). Ao clicar em
            solicitar, um e-mail será disparado pra cada médico com os dados
            pra emissão da NF-e.
          </Alert>
        )}

        {loading && !data && <Skeleton variant="rounded" height={300} />}

        {data && data.items.length === 0 && (
          <Paper
            sx={{
              p: 5,
              textAlign: 'center',
              border: `1px dashed ${C.border}`,
              borderRadius: 2,
            }}
          >
            <Typography color={C.textMuted}>
              Nenhum fechamento publicado com esses filtros.
            </Typography>
            <Typography fontSize={12} color={C.textMuted} mt={0.5}>
              Fechamentos aparecem aqui depois que o time Cobreai publica no
              painel administrativo.
            </Typography>
          </Paper>
        )}

        {data && data.items.length > 0 && (
          <Paper sx={{ border: `1px solid ${C.border}`, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      indeterminate={
                        selectedIds.size > 0 &&
                        selectedIds.size < selectableIds.length
                      }
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === selectableIds.length &&
                        selectableIds.length > 0
                      }
                      disabled={selectableIds.length === 0}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    MÉDICO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    STATUS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  >
                    HOSP.
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
                    LÍQUIDO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    ÚLTIMA MUDANÇA
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map(item => {
                  const canSelect =
                    item.status === 'published' ||
                    item.status === 'nf_rejected';
                  const st = STATUS.find(s => s.key === item.status);
                  return (
                    <PayoutRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      canSelect={canSelect}
                      onToggleSelect={() => toggleOne(item.id)}
                      onOpen={() => setDetailId(item.id)}
                      statusColor={st?.color || C.textMuted}
                      statusBg={st?.bg || C.borderSoft}
                      statusLabel={st?.label || item.status}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {detailId && current?.id && (
        <PayoutDetailDialog
          enterpriseId={current.id}
          payoutId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </PrivateLayout>
  );
}

function PayoutRow({
  item,
  selected,
  canSelect,
  onToggleSelect,
  onOpen,
  statusColor,
  statusBg,
  statusLabel,
}: {
  item: PayoutListItem;
  selected: boolean;
  canSelect: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  statusColor: string;
  statusBg: string;
  statusLabel: string;
}) {
  return (
    <TableRow hover sx={{ cursor: 'pointer' }}>
      <TableCell padding="checkbox">
        <Checkbox
          size="small"
          icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
          checkedIcon={<CheckBoxIcon fontSize="small" />}
          checked={selected}
          disabled={!canSelect}
          onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
        />
      </TableCell>
      <TableCell onClick={onOpen}>
        <Box>
          <Typography fontSize={13} fontWeight={500}>
            {item.user_name ?? '—'}
          </Typography>
          <Typography fontSize={11} color={C.textMuted}>
            {item.user_email}
            {item.user_crm ? ` · CRM ${item.user_crm}` : ''}
          </Typography>
        </Box>
      </TableCell>
      <TableCell onClick={onOpen}>
        <Chip
          size="small"
          label={statusLabel}
          sx={{
            color: statusColor,
            bgcolor: statusBg,
            fontWeight: 600,
            fontSize: 11,
          }}
        />
      </TableCell>
      <TableCell align="right" onClick={onOpen} sx={{ fontSize: 13 }}>
        {item.hospitals_count}
      </TableCell>
      <TableCell align="right" onClick={onOpen} sx={{ fontSize: 13 }}>
        {item.appointments_count}
      </TableCell>
      <TableCell
        align="right"
        onClick={onOpen}
        sx={{ fontSize: 13, fontWeight: 600 }}
      >
        {BRL(item.liquido)}
      </TableCell>
      <TableCell onClick={onOpen} sx={{ fontSize: 12, color: C.textMuted }}>
        {new Date(item.updated_at).toLocaleString('pt-BR')}
      </TableCell>
    </TableRow>
  );
}
