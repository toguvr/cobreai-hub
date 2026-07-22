import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';
import ClickSignSection from './ClickSignSection';

interface ExpertiseRow {
  id: string;
  name: string;
  hospital_id: string;
  hospital_name: string;
  need_recognize: boolean;
  verify_geolocation: boolean;
  late_entry_justification: boolean;
  early_exit_justification: boolean;
  auto_swap: boolean;
  auto_register: boolean;
  has_confirmation: boolean;
  score_productivity: boolean;
  discount_absence: boolean;
  send_remember_push: boolean;
  enterprise_locks: Record<string, boolean>;
}

type SettingKey = keyof Pick<
  ExpertiseRow,
  | 'need_recognize'
  | 'verify_geolocation'
  | 'late_entry_justification'
  | 'early_exit_justification'
  | 'auto_swap'
  | 'auto_register'
  | 'has_confirmation'
  | 'score_productivity'
  | 'discount_absence'
  | 'send_remember_push'
>;

const SETTINGS: Array<{
  key: SettingKey;
  label: string;
  group: 'Checkin' | 'Justificativas' | 'Plantões' | 'Outros';
}> = [
  { key: 'need_recognize', label: 'Reconhecimento facial', group: 'Checkin' },
  { key: 'verify_geolocation', label: 'Geolocalização', group: 'Checkin' },
  { key: 'late_entry_justification', label: 'Just. de atraso (checkin)', group: 'Justificativas' },
  { key: 'early_exit_justification', label: 'Just. de saída antecipada', group: 'Justificativas' },
  { key: 'auto_swap', label: 'Troca automática', group: 'Plantões' },
  { key: 'auto_register', label: 'Presença automática', group: 'Plantões' },
  { key: 'has_confirmation', label: 'Confirmação WhatsApp', group: 'Plantões' },
  { key: 'score_productivity', label: 'Score de produtividade', group: 'Outros' },
  { key: 'discount_absence', label: 'Descontar ausência', group: 'Outros' },
  { key: 'send_remember_push', label: 'Lembrete push', group: 'Outros' },
];

const C = {
  border: '#e8eef2',
  textMuted: '#64748b',
  surface: '#ffffff',
  lockedBg: '#eef6ff',
  lockedBorder: '#bcd9f7',
};

export default function Settings() {
  const { current, enterprises } = useEnterprise();
  const enterpriseId = current?.id;

  const [rows, setRows] = useState<ExpertiseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const isOrgAdmin = useMemo(() => {
    if (!current) return false;
    const link = enterprises.find(ue => ue.enterprise.id === current.id);
    return link?.role === 'org_admin';
  }, [current, enterprises]);

  const load = useCallback(async () => {
    if (!enterpriseId) return;
    setLoading(true);
    try {
      const res = await api.get<ExpertiseRow[]>(
        `/enterprise/${enterpriseId}/expertises`,
      );
      setRows(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao carregar.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    load();
  }, [load]);

  const byHospital = useMemo(() => {
    const map = new Map<string, { name: string; items: ExpertiseRow[] }>();
    rows.forEach(r => {
      const entry = map.get(r.hospital_id) ?? {
        name: r.hospital_name,
        items: [],
      };
      entry.items.push(r);
      map.set(r.hospital_id, entry);
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name),
    );
  }, [rows]);

  async function patch(expertise: ExpertiseRow, body: Record<string, any>) {
    if (!enterpriseId) return;
    const tag = `${expertise.id}:${Object.keys(body)[0]}`;
    setSavingKey(tag);
    try {
      const res = await api.patch<ExpertiseRow>(
        `/enterprise/${enterpriseId}/expertises/${expertise.id}`,
        body,
      );
      setRows(prev => prev.map(r => (r.id === expertise.id ? { ...r, ...res.data } : r)));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSavingKey(null);
    }
  }

  async function bulkApply(
    setting_key: SettingKey,
    body: { value?: boolean; locked?: boolean },
  ) {
    if (!enterpriseId) return;
    const tag = `bulk:${setting_key}`;
    setSavingKey(tag);
    try {
      const res = await api.patch<{ updated: number }>(
        `/enterprise/${enterpriseId}/expertises/bulk`,
        { setting_key, ...body },
      );
      toast.success(
        `Aplicado em ${res.data.updated} especialidade${
          res.data.updated === 1 ? '' : 's'
        }.`,
      );
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao aplicar em lote.');
    } finally {
      setSavingKey(null);
    }
  }

  // Estado agregado: quantas expertises têm o setting ativado / travado
  function aggregate(key: SettingKey) {
    let on = 0;
    let locked = 0;
    for (const r of rows) {
      if (r[key]) on += 1;
      if (r.enterprise_locks?.[key]) locked += 1;
    }
    return { on, locked, total: rows.length };
  }

  return (
    <PrivateLayout>
      <Box maxWidth={1100} mx="auto" width="100%" p={2}>
        <Stack gap={0.5} mb={2}>
          <Typography fontSize={22} fontWeight={700} color="primary.dark">
            Configurações das especialidades
          </Typography>
          <Typography fontSize={13} color={C.textMuted}>
            Controle quais funcionalidades cada hospital pode alterar. Quando uma
            chave está <strong>travada</strong>, o admin do hospital vê o valor
            mas não consegue mudar.
          </Typography>
        </Stack>

        {!isOrgAdmin && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Você está no modo somente leitura. Apenas administradores da empresa
            (org_admin) podem trancar/destrancar configurações.
          </Alert>
        )}

        {enterpriseId && isOrgAdmin && (
          <ClickSignSection enterpriseId={enterpriseId} canEdit={isOrgAdmin} />
        )}

        {!loading && rows.length > 0 && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              border: `1px solid ${C.border}`,
              bgcolor: C.surface,
            }}
            elevation={0}
          >
            <Stack gap={0.5} mb={1.5}>
              <Typography fontWeight={700} fontSize={14}>
                Aplicar a todas as especialidades da empresa
              </Typography>
              <Typography fontSize={11} color={C.textMuted}>
                {rows.length} especialidades em {byHospital.length} hospital
                {byHospital.length === 1 ? '' : 's'}. Cada ação é propagada
                imediatamente.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 1,
              }}
            >
              {SETTINGS.map(s => {
                const agg = aggregate(s.key);
                const allOn = agg.on === agg.total;
                const allLocked = agg.locked === agg.total;
                const tag = `bulk:${s.key}`;
                return (
                  <Box
                    key={s.key}
                    sx={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 1.5,
                      p: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box flex={1} minWidth={0}>
                      <Typography fontSize={13} fontWeight={500} noWrap>
                        {s.label}
                      </Typography>
                      <Typography
                        fontSize={10}
                        color={C.textMuted}
                        textTransform="uppercase"
                        letterSpacing={0.4}
                      >
                        {agg.on}/{agg.total} ativas · {agg.locked}/{agg.total}{' '}
                        travadas
                      </Typography>
                    </Box>

                    <Tooltip title={`Ligar em todas (atualmente ${agg.on}/${agg.total})`}>
                      <span>
                        <Button
                          size="small"
                          variant={allOn ? 'contained' : 'outlined'}
                          disabled={!isOrgAdmin || savingKey === tag}
                          onClick={() => bulkApply(s.key, { value: true })}
                          sx={{ minWidth: 56 }}
                        >
                          ON
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip title={`Desligar em todas`}>
                      <span>
                        <Button
                          size="small"
                          variant={agg.on === 0 ? 'contained' : 'outlined'}
                          color="inherit"
                          disabled={!isOrgAdmin || savingKey === tag}
                          onClick={() => bulkApply(s.key, { value: false })}
                          sx={{ minWidth: 56 }}
                        >
                          OFF
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip
                      title={
                        allLocked
                          ? 'Destravar em todas'
                          : 'Travar em todas (admin do hospital não pode mexer)'
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant={allLocked ? 'contained' : 'outlined'}
                          color={allLocked ? 'primary' : 'inherit'}
                          disabled={!isOrgAdmin || savingKey === tag}
                          onClick={() =>
                            bulkApply(s.key, { locked: !allLocked })
                          }
                          startIcon={
                            allLocked ? (
                              <LockIcon fontSize="small" />
                            ) : (
                              <LockOpenIcon fontSize="small" />
                            )
                          }
                        >
                          {allLocked ? 'Travada' : 'Travar'}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" p={6}>
            <CircularProgress />
          </Box>
        ) : byHospital.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', border: `1px solid ${C.border}` }}>
            <Typography color={C.textMuted}>
              Nenhuma especialidade encontrada nos hospitais desta empresa.
            </Typography>
          </Paper>
        ) : (
          byHospital.map(([hid, { name, items }]) => (
            <Accordion
              key={hid}
              defaultExpanded={byHospital.length === 1}
              sx={{
                mb: 1,
                border: `1px solid ${C.border}`,
                bgcolor: C.surface,
                '&:before': { display: 'none' },
              }}
              elevation={0}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="baseline" gap={1.5} flex={1}>
                  <Typography fontWeight={600} fontSize={15}>
                    {name}
                  </Typography>
                  <Typography fontSize={12} color={C.textMuted}>
                    {items.length} especialidade{items.length === 1 ? '' : 's'}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {items.map(exp => (
                  <Box
                    key={exp.id}
                    sx={{
                      borderTop: `1px solid ${C.border}`,
                      py: 1.5,
                    }}
                  >
                    <Typography fontWeight={600} fontSize={14} mb={1}>
                      {exp.name}
                    </Typography>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                        gap: 1,
                      }}
                    >
                      {SETTINGS.map(s => {
                        const locked = Boolean(exp.enterprise_locks?.[s.key]);
                        const value = Boolean(exp[s.key]);
                        const valTag = `${exp.id}:${s.key}`;
                        const lockTag = `${exp.id}:locks`;
                        return (
                          <Box
                            key={s.key}
                            sx={{
                              border: `1px solid ${locked ? C.lockedBorder : C.border}`,
                              borderRadius: 1.5,
                              p: 1.25,
                              bgcolor: locked ? C.lockedBg : C.surface,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box flex={1} minWidth={0}>
                              <Typography fontSize={13} fontWeight={500} noWrap>
                                {s.label}
                              </Typography>
                              <Typography fontSize={10} color={C.textMuted} textTransform="uppercase" letterSpacing={0.4}>
                                {s.group}
                              </Typography>
                            </Box>

                            <Tooltip
                              title={
                                value
                                  ? 'Ativo (clique p/ desligar)'
                                  : 'Inativo (clique p/ ligar)'
                              }
                            >
                              <span>
                                <Switch
                                  size="small"
                                  checked={value}
                                  disabled={!isOrgAdmin || savingKey === valTag}
                                  onChange={e =>
                                    patch(exp, { [s.key]: e.target.checked })
                                  }
                                />
                              </span>
                            </Tooltip>

                            <Tooltip
                              title={
                                locked
                                  ? 'Travado — admin do hospital não pode mudar. Clique p/ liberar.'
                                  : 'Liberado — admin do hospital pode mudar. Clique p/ travar.'
                              }
                            >
                              <span>
                                <Box
                                  component="button"
                                  onClick={() =>
                                    patch(exp, {
                                      locks: { [s.key]: !locked },
                                    })
                                  }
                                  disabled={!isOrgAdmin || savingKey === lockTag}
                                  sx={{
                                    border: 'none',
                                    bgcolor: 'transparent',
                                    cursor: isOrgAdmin ? 'pointer' : 'not-allowed',
                                    color: locked ? 'primary.dark' : C.textMuted,
                                    display: 'flex',
                                    alignItems: 'center',
                                    p: 0.5,
                                    opacity: isOrgAdmin ? 1 : 0.4,
                                  }}
                                >
                                  {locked ? (
                                    <LockIcon fontSize="small" />
                                  ) : (
                                    <LockOpenIcon fontSize="small" />
                                  )}
                                </Box>
                              </span>
                            </Tooltip>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Box>
    </PrivateLayout>
  );
}
