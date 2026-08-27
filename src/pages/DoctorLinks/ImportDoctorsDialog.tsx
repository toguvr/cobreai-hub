import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import DownloadingIcon from '@mui/icons-material/Downloading';
import { toast } from 'react-toastify';

import api from '../../services/api';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import type { ImportableDoctor, ImportDoctorsResult } from '../../dtos';

interface Props {
  open: boolean;
  onClose(): void;
  onImported(): void;
}

const BORDER = '#e8eef2';

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const STATUS_CHIP: Record<
  ImportableDoctor['existing_status'],
  { label: string; color: 'default' | 'info' | 'warning' | 'error' } | null
> = {
  none: null,
  member: { label: 'membro do hub', color: 'info' },
  pending: { label: 'credenciamento em análise', color: 'warning' },
  rejected: { label: 'recusado antes', color: 'error' },
};

export function ImportDoctorsDialog({ open, onClose, onImported }: Props) {
  const { current } = useEnterprise();

  const [doctors, setDoctors] = useState<ImportableDoctor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ImportableDoctor[]>(
        `/enterprise/${current.id}/doctors/importable`,
      );
      const list = Array.isArray(res.data) ? res.data : [];
      setDoctors(list);
      // Pré-seleciona todo mundo menos quem já foi recusado — esse caso
      // precisa de decisão consciente na tela de Credenciamento.
      setSelected(
        new Set(
          list.filter(d => d.existing_status !== 'rejected').map(d => d.id),
        ),
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message || 'Erro ao carregar os médicos.',
      );
    } finally {
      setLoading(false);
    }
  }, [current?.id]);

  useEffect(() => {
    if (!open) {
      setDoctors([]);
      setSelected(new Set());
      setSearch('');
      setError(null);
      return;
    }
    load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return doctors;
    return doctors.filter(
      d =>
        norm(d.name || '').includes(q) ||
        norm(d.email || '').includes(q) ||
        norm(d.crm || '').includes(q) ||
        d.hospital_names.some(h => norm(h).includes(q)),
    );
  }, [doctors, search]);

  const selectableFiltered = filtered.filter(
    d => d.existing_status !== 'rejected',
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setAll = (checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const doctor of selectableFiltered) {
        if (checked) next.add(doctor.id);
        else next.delete(doctor.id);
      }
      return next;
    });
  };

  const doImport = async () => {
    if (!current?.id || selected.size === 0) return;
    setImporting(true);
    try {
      const res = await api.post<ImportDoctorsResult>(
        `/enterprise/${current.id}/doctors/import`,
        { user_ids: Array.from(selected) },
      );
      const { imported, skipped } = res.data;
      if (imported > 0) {
        toast.success(
          `${imported} médico(s) credenciado(s)${
            skipped.length > 0 ? ` · ${skipped.length} ignorado(s)` : ''
          }.`,
        );
      } else {
        toast.warning('Nenhum médico foi credenciado.');
      }
      if (skipped.length > 0) {
        // Motivos ficam visíveis: importar em lote sem explicar o que
        // ficou de fora é o tipo de silêncio que vira suporte depois.
        skipped.slice(0, 4).forEach(s => toast.info(`${s.name}: ${s.reason}`));
      }
      onImported();
      onClose();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao credenciar os médicos.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !importing && onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { height: 'min(85vh, 820px)' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontSize={17} fontWeight={700}>
          Puxar médicos dos hospitais
        </Typography>
        <Typography fontSize={12} color="text.secondary">
          Quem já trabalha nos hospitais da organização mas ainda não consta
          como credenciado. Eles já têm conta no app — nada de e-mail ou
          troca de senha.
        </Typography>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            placeholder="Buscar por nome, e-mail, CRM ou hospital"
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
              onClick={() => setAll(true)}
              disabled={loading || selectableFiltered.length === 0}
            >
              Marcar todos
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => setAll(false)}
              disabled={loading || selectableFiltered.length === 0}
            >
              Desmarcar
            </Button>
          </Stack>
        </Stack>
      </Box>

      <DialogContent dividers>
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
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={66} />
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Box textAlign="center" py={6}>
            <DownloadingIcon sx={{ fontSize: 40, color: '#64748b', mb: 1 }} />
            <Typography fontSize={15} fontWeight={600}>
              {doctors.length === 0
                ? 'Nada para puxar'
                : 'Nenhum resultado para a busca'}
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              {doctors.length === 0
                ? 'Todo mundo que atua nos hospitais da organização já está credenciado.'
                : 'Tente outro termo.'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {filtered.map(doctor => {
              const isRejected = doctor.existing_status === 'rejected';
              const statusChip = STATUS_CHIP[doctor.existing_status];
              const checked = selected.has(doctor.id);

              return (
                <Paper
                  key={doctor.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    opacity: isRejected ? 0.6 : 1,
                  }}
                >
                  <Tooltip
                    title={
                      isRejected
                        ? 'Este médico foi recusado antes. Reveja em Credenciamento.'
                        : ''
                    }
                  >
                    <span>
                      <Checkbox
                        checked={checked}
                        disabled={isRejected}
                        onChange={e => toggle(doctor.id, e.target.checked)}
                      />
                    </span>
                  </Tooltip>

                  <Avatar
                    src={doctor.avatar_url ?? undefined}
                    sx={{ width: 38, height: 38, fontSize: 14, fontWeight: 600 }}
                  >
                    {doctor.name?.[0]?.toUpperCase()}
                  </Avatar>

                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography fontSize={14} fontWeight={600} noWrap>
                        {doctor.name || '—'}
                      </Typography>
                      {statusChip && (
                        <Chip
                          size="small"
                          label={statusChip.label}
                          color={statusChip.color}
                          variant="outlined"
                          sx={{ height: 19, fontSize: 10 }}
                        />
                      )}
                      {doctor.is_hospital_admin && (
                        <Chip
                          size="small"
                          label="admin do hospital"
                          variant="outlined"
                          sx={{ height: 19, fontSize: 10 }}
                        />
                      )}
                    </Stack>
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      {[doctor.email, doctor.crm && `CRM ${doctor.crm}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>

                  <Box flex={1} minWidth={180}>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {doctor.hospital_names.slice(0, 2).map(name => (
                        <Chip
                          key={name}
                          size="small"
                          icon={<LocalHospitalIcon sx={{ fontSize: 13 }} />}
                          label={name}
                          sx={{ height: 21, fontSize: 11, maxWidth: 170 }}
                        />
                      ))}
                      {doctor.hospital_names.length > 2 && (
                        <Tooltip title={doctor.hospital_names.slice(2).join(', ')}>
                          <Chip
                            size="small"
                            label={`+${doctor.hospital_names.length - 2}`}
                            sx={{ height: 21, fontSize: 11 }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    <Typography fontSize={11} color="text.secondary" mt={0.4}>
                      {doctor.expertises_count} especialidade(s)
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Typography fontSize={12} color="text.secondary" flex={1}>
          {selected.size} de {doctors.length} selecionado(s)
        </Typography>
        <Button onClick={onClose} disabled={importing}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={doImport}
          disabled={importing || loading || selected.size === 0}
          startIcon={
            importing ? <CircularProgress size={14} color="inherit" /> : undefined
          }
        >
          Credenciar {selected.size > 0 ? selected.size : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImportDoctorsDialog;
