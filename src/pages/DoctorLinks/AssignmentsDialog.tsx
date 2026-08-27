import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { toast } from 'react-toastify';

import api from '../../services/api';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import type {
  AssignmentHospital,
  DoctorAssignments,
  SyncAssignmentsResult,
} from '../../dtos';

interface DraftHospital {
  linked: boolean;
  expertises: Set<string>;
}

type Draft = Record<string, DraftHospital>;

interface Props {
  userId: string | null;
  onClose(): void;
  /** Chamado depois de salvar, pra a listagem recarregar. */
  onSaved(): void;
}

function buildDraft(hospitals: AssignmentHospital[]): Draft {
  const draft: Draft = {};
  for (const hospital of hospitals) {
    draft[hospital.id] = {
      linked: hospital.linked,
      expertises: new Set(
        hospital.expertises.filter(e => e.linked).map(e => e.id),
      ),
    };
  }
  return draft;
}

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function AssignmentsDialog({ userId, onClose, onSaved }: Props) {
  const { current } = useEnterprise();

  const [data, setData] = useState<DoctorAssignments | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const open = !!userId;

  const load = useCallback(async () => {
    if (!current?.id || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DoctorAssignments>(
        `/enterprise/${current.id}/doctors/${userId}/assignments`,
      );
      setData(res.data);
      setDraft(buildDraft(res.data.hospitals));
      // Já abre os hospitais em que o médico atua — é onde o admin mexe.
      setExpanded(
        new Set(res.data.hospitals.filter(h => h.linked).map(h => h.id)),
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message || 'Erro ao carregar os vínculos.',
      );
    } finally {
      setLoading(false);
    }
  }, [current?.id, userId]);

  useEffect(() => {
    if (!open) {
      setData(null);
      setDraft({});
      setSearch('');
      setError(null);
      setExpanded(new Set());
      return;
    }
    load();
  }, [open, load]);

  // ─── Mutações do rascunho ─────────────────────────────────────────────

  const setHospitalLinked = (hospital: AssignmentHospital, linked: boolean) => {
    setDraft(prev => ({
      ...prev,
      [hospital.id]: {
        linked,
        // Desvincular o hospital tira junto todas as especialidades dele.
        expertises: linked
          ? prev[hospital.id]?.expertises ?? new Set<string>()
          : new Set<string>(),
      },
    }));
  };

  const toggleExpertise = (
    hospital: AssignmentHospital,
    expertiseId: string,
    checked: boolean,
  ) => {
    setDraft(prev => {
      const currentDraft = prev[hospital.id] ?? {
        linked: false,
        expertises: new Set<string>(),
      };
      const expertises = new Set(currentDraft.expertises);
      if (checked) expertises.add(expertiseId);
      else expertises.delete(expertiseId);
      return {
        ...prev,
        [hospital.id]: {
          // Marcar especialidade implica estar vinculado ao hospital.
          linked: checked ? true : currentDraft.linked,
          expertises,
        },
      };
    });
  };

  const setAllExpertises = (
    hospitals: AssignmentHospital[],
    checked: boolean,
  ) => {
    setDraft(prev => {
      const next = { ...prev };
      for (const hospital of hospitals) {
        const currentDraft = prev[hospital.id] ?? {
          linked: false,
          expertises: new Set<string>(),
        };
        const expertises = new Set(currentDraft.expertises);
        // `hospital.expertises` pode vir filtrado pela busca — só mexemos
        // no que está visível, o resto da seleção é preservado.
        for (const expertise of hospital.expertises) {
          if (checked) expertises.add(expertise.id);
          else expertises.delete(expertise.id);
        }
        next[hospital.id] = {
          linked: checked ? true : currentDraft.linked,
          expertises,
        };
      }
      return next;
    });
  };

  // ─── Filtro ───────────────────────────────────────────────────────────

  const query = norm(search.trim());

  const visibleHospitals = useMemo(() => {
    if (!data) return [] as AssignmentHospital[];
    if (!query) return data.hospitals;

    return data.hospitals
      .map(hospital => {
        if (norm(hospital.name).includes(query)) return hospital;
        const expertises = hospital.expertises.filter(e =>
          norm(e.name).includes(query),
        );
        return expertises.length > 0 ? { ...hospital, expertises } : null;
      })
      .filter((h): h is AssignmentHospital => h !== null);
  }, [data, query]);

  // Busca abre o que sobrou do filtro — sem isso o resultado fica escondido.
  useEffect(() => {
    if (!query) return;
    setExpanded(new Set(visibleHospitals.map(h => h.id)));
    // visibleHospitals é derivado de query; depender só de query evita loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ─── Diff ─────────────────────────────────────────────────────────────

  const diff = useMemo(() => {
    const result = {
      hospitalsIn: [] as AssignmentHospital[],
      hospitalsOut: [] as AssignmentHospital[],
      expertisesIn: 0,
      expertisesOut: 0,
      risky: [] as string[],
    };
    if (!data) return result;

    for (const hospital of data.hospitals) {
      const state = draft[hospital.id];
      if (!state) continue;

      if (state.linked && !hospital.linked) result.hospitalsIn.push(hospital);
      if (!state.linked && hospital.linked) {
        result.hospitalsOut.push(hospital);
        if (hospital.future_appointments > 0) {
          result.risky.push(
            `${hospital.name} — ${hospital.future_appointments} plantão(ões) futuro(s)`,
          );
        }
      }

      for (const expertise of hospital.expertises) {
        const selected = state.expertises.has(expertise.id);
        if (selected && !expertise.linked) result.expertisesIn += 1;
        if (!selected && expertise.linked) {
          result.expertisesOut += 1;
          if (expertise.future_appointments > 0 && state.linked) {
            result.risky.push(
              `${hospital.name} · ${expertise.name} — ${expertise.future_appointments} plantão(ões) futuro(s)`,
            );
          }
        }
      }
    }
    return result;
  }, [data, draft]);

  const hasChanges =
    diff.hospitalsIn.length > 0 ||
    diff.hospitalsOut.length > 0 ||
    diff.expertisesIn > 0 ||
    diff.expertisesOut > 0;

  const totals = useMemo(() => {
    const hospitals = Object.values(draft).filter(d => d.linked).length;
    const expertises = Object.values(draft).reduce(
      (acc, d) => acc + d.expertises.size,
      0,
    );
    return { hospitals, expertises };
  }, [draft]);

  // ─── Salvar ───────────────────────────────────────────────────────────

  const save = async () => {
    if (!current?.id || !userId || !data) return;
    setSaving(true);
    try {
      const res = await api.put<SyncAssignmentsResult>(
        `/enterprise/${current.id}/doctors/${userId}/assignments`,
        {
          hospitals: data.hospitals.map(hospital => ({
            hospital_id: hospital.id,
            linked: draft[hospital.id]?.linked ?? false,
            expertise_ids: Array.from(draft[hospital.id]?.expertises ?? []),
          })),
        },
      );

      const r = res.data;
      const parts = [
        r.linked_hospitals && `+${r.linked_hospitals} hospital(is)`,
        r.unlinked_hospitals && `−${r.unlinked_hospitals} hospital(is)`,
        r.linked_expertises && `+${r.linked_expertises} especialidade(s)`,
        r.unlinked_expertises && `−${r.unlinked_expertises} especialidade(s)`,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `Vínculos atualizados: ${parts.join(' · ')}.`
          : 'Vínculos atualizados.',
      );
      if (r.pending_hospitals > 0) {
        toast.info(
          `${r.pending_hospitals} hospital(is) aguardando autorização. O médico só entra na escala de cada um depois que o hospital aprovar a solicitação.`,
          { autoClose: 8000 },
        );
      }

      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao salvar os vínculos.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const doctor = data?.doctor;

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: 'min(88vh, 860px)' } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            src={doctor?.avatar_url ?? undefined}
            sx={{ width: 42, height: 42, fontSize: 15, fontWeight: 600 }}
          >
            {doctor?.name?.[0]?.toUpperCase()}
          </Avatar>
          <Box minWidth={0}>
            <Typography fontSize={16} fontWeight={700} noWrap>
              {doctor?.name ?? 'Vínculos'}
            </Typography>
            <Typography fontSize={12} color="text.secondary" noWrap>
              {[doctor?.email, doctor?.crm && `CRM ${doctor.crm}`]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
        >
          <TextField
            size="small"
            placeholder="Buscar hospital ou especialidade"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              onClick={() => setAllExpertises(visibleHospitals, true)}
              disabled={loading || visibleHospitals.length === 0}
            >
              Marcar todas
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => setAllExpertises(visibleHospitals, false)}
              disabled={loading || visibleHospitals.length === 0}
            >
              Desmarcar todas
            </Button>
          </Stack>
        </Stack>
        {query && (
          <Typography fontSize={11} color="text.secondary" mt={0.75}>
            As ações acima valem só para o que está filtrado (
            {visibleHospitals.length} hospital(is)).
          </Typography>
        )}
      </Box>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Alert severity="info" icon={<HourglassTopIcon />} sx={{ mb: 2 }}>
          <Typography fontSize={12}>
            Marcar um hospital cria uma <b>solicitação</b>. O hospital precisa
            autorizar no painel dele (Usuários → Solicitações) antes do médico
            poder ser escalado lá. As especialidades escolhidas já ficam
            registradas e passam a valer junto com a autorização.
          </Typography>
        </Alert>

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={load}>
                Tentar de novo
              </Button>
            }
          >
            {error}
          </Alert>
        ) : loading ? (
          <Stack spacing={1}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={56} />
            ))}
          </Stack>
        ) : visibleHospitals.length === 0 ? (
          <Box textAlign="center" py={6}>
            <Typography fontSize={14} fontWeight={600}>
              {data && data.hospitals.length === 0
                ? 'Nenhum hospital nesta organização'
                : 'Nenhum resultado para a busca'}
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              {data && data.hospitals.length === 0
                ? 'Vincule hospitais à organização antes de credenciar médicos.'
                : 'Tente outro termo.'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {visibleHospitals.map(hospital => {
              const state = draft[hospital.id] ?? {
                linked: false,
                expertises: new Set<string>(),
              };
              const selectedCount = hospital.expertises.filter(e =>
                state.expertises.has(e.id),
              ).length;
              const isOpen = expanded.has(hospital.id);

              return (
                <Accordion
                  key={hospital.id}
                  expanded={isOpen}
                  onChange={() =>
                    setExpanded(prev => {
                      const next = new Set(prev);
                      if (next.has(hospital.id)) next.delete(hospital.id);
                      else next.add(hospital.id);
                      return next;
                    })
                  }
                  disableGutters
                  elevation={0}
                  sx={{
                    border: '1px solid #e8eef2',
                    borderRadius: 2,
                    '&:before': { display: 'none' },
                    bgcolor: state.linked ? 'primary.light' : '#fff',
                    transition: 'background-color 0.15s',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      flex={1}
                      minWidth={0}
                    >
                      <Tooltip title="Vincular ao hospital">
                        <Checkbox
                          checked={state.linked}
                          onClick={e => e.stopPropagation()}
                          onChange={e =>
                            setHospitalLinked(hospital, e.target.checked)
                          }
                          sx={{ p: 0.5 }}
                        />
                      </Tooltip>
                      <Box flex={1} minWidth={0}>
                        <Typography fontSize={14} fontWeight={600} noWrap>
                          {hospital.name}
                        </Typography>
                        {(hospital.cidade || hospital.uf) && (
                          <Typography fontSize={11} color="text.secondary" noWrap>
                            {[hospital.cidade, hospital.uf]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        )}
                      </Box>
                      {hospital.linked && !hospital.accepted && (
                        <Tooltip title="O hospital ainda não autorizou este vínculo. Enquanto isso o médico não aparece para ser escalado lá.">
                          <Chip
                            size="small"
                            icon={<HourglassTopIcon sx={{ fontSize: 13 }} />}
                            label="aguardando hospital"
                            color="warning"
                            variant="outlined"
                            sx={{ height: 22, fontSize: 10, fontWeight: 600 }}
                          />
                        </Tooltip>
                      )}
                      <Chip
                        size="small"
                        label={`${selectedCount}/${hospital.expertises.length} esp.`}
                        color={selectedCount > 0 ? 'primary' : 'default'}
                        variant={selectedCount > 0 ? 'filled' : 'outlined'}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                      />
                    </Stack>
                  </AccordionSummary>

                  <AccordionDetails sx={{ pt: 0, bgcolor: '#fff' }}>
                    <Divider sx={{ mb: 1.5 }} />
                    {hospital.expertises.length === 0 ? (
                      <Typography fontSize={12} color="text.secondary">
                        Este hospital ainda não tem especialidades cadastradas.
                      </Typography>
                    ) : (
                      <>
                        <Stack direction="row" spacing={0.5} mb={0.5}>
                          <Button
                            size="small"
                            onClick={() => setAllExpertises([hospital], true)}
                          >
                            Todas
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => setAllExpertises([hospital], false)}
                          >
                            Nenhuma
                          </Button>
                        </Stack>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              sm: 'repeat(2, minmax(0, 1fr))',
                            },
                            columnGap: 1,
                          }}
                        >
                          {hospital.expertises.map(expertise => {
                            const checked = state.expertises.has(expertise.id);
                            const losing = expertise.linked && !checked;
                            return (
                              <Stack
                                key={expertise.id}
                                direction="row"
                                alignItems="center"
                                spacing={0.5}
                                minWidth={0}
                              >
                                <FormControlLabel
                                  sx={{ minWidth: 0, mr: 0 }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={checked}
                                      onChange={e =>
                                        toggleExpertise(
                                          hospital,
                                          expertise.id,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  }
                                  label={
                                    <Typography fontSize={13} noWrap>
                                      {expertise.name}
                                    </Typography>
                                  }
                                />
                                {losing && expertise.future_appointments > 0 && (
                                  <Tooltip
                                    title={`${expertise.future_appointments} plantão(ões) futuro(s) já escalado(s) nesta especialidade`}
                                  >
                                    <Chip
                                      size="small"
                                      icon={<EventBusyIcon sx={{ fontSize: 13 }} />}
                                      label={expertise.future_appointments}
                                      color="warning"
                                      sx={{ height: 20, fontSize: 10 }}
                                    />
                                  </Tooltip>
                                )}
                              </Stack>
                            );
                          })}
                        </Box>
                      </>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}

        {diff.risky.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography fontSize={13} fontWeight={600} mb={0.5}>
              Há plantões futuros nos vínculos que você está removendo
            </Typography>
            <Typography fontSize={12} component="div">
              {diff.risky.slice(0, 6).map(line => (
                <div key={line}>• {line}</div>
              ))}
              {diff.risky.length > 6 && <div>• e mais {diff.risky.length - 6}…</div>}
            </Typography>
            <Typography fontSize={12} mt={0.5}>
              Os plantões continuam existindo, mas o médico deixa de aparecer
              como habilitado. Reveja a escala depois de salvar.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Box flex={1} minWidth={0}>
          <Typography fontSize={12} color="text.secondary" noWrap>
            {totals.hospitals} hospital(is) · {totals.expertises}{' '}
            especialidade(s) selecionada(s)
          </Typography>
          {hasChanges && (
            <Typography fontSize={11} color="primary.main" noWrap>
              {[
                diff.hospitalsIn.length && `+${diff.hospitalsIn.length} hosp.`,
                diff.hospitalsOut.length && `−${diff.hospitalsOut.length} hosp.`,
                diff.expertisesIn && `+${diff.expertisesIn} esp.`,
                diff.expertisesOut && `−${diff.expertisesOut} esp.`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          )}
        </Box>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={saving || loading || !hasChanges}
          startIcon={
            saving ? <CircularProgress size={14} color="inherit" /> : undefined
          }
        >
          {diff.risky.length > 0 ? 'Salvar mesmo assim' : 'Salvar vínculos'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AssignmentsDialog;
