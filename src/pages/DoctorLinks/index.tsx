import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DownloadingIcon from '@mui/icons-material/Downloading';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';
import type { DoctorListItem } from '../../dtos';
import { AssignmentsDialog } from './AssignmentsDialog';
import { ImportDoctorsDialog } from './ImportDoctorsDialog';

type Filter = 'all' | 'unlinked' | 'pending' | 'linked';

const BORDER = '#e8eef2';

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function DoctorRow({
  doctor,
  onManage,
}: {
  doctor: DoctorListItem;
  onManage(): void;
}) {
  const preview = doctor.hospital_names.slice(0, 3);
  const rest = doctor.hospital_names.length - preview.length;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: `1px solid ${BORDER}`,
        borderRadius: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        transition: 'border-color 0.12s, box-shadow 0.12s',
        '&:hover': {
          borderColor: '#cbd5e1',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        },
      }}
    >
      <Avatar
        src={doctor.avatar_url ?? undefined}
        sx={{ width: 42, height: 42, fontSize: 14, fontWeight: 600 }}
      >
        {doctor.name?.[0]?.toUpperCase()}
      </Avatar>

      <Box flex={1} minWidth={200}>
        <Typography fontSize={14} fontWeight={600} noWrap>
          {doctor.name || '—'}
        </Typography>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {[doctor.email, doctor.crm && `CRM ${doctor.crm}`]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>

      <Box flex={1.4} minWidth={220}>
        {doctor.hospitals_count === 0 ? (
          <Chip
            size="small"
            label="Sem vínculo"
            color="warning"
            variant="outlined"
            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
          />
        ) : (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {preview.map(name => (
              <Chip
                key={name}
                size="small"
                icon={<LocalHospitalIcon sx={{ fontSize: 13 }} />}
                label={name}
                sx={{ height: 22, fontSize: 11, maxWidth: 180 }}
              />
            ))}
            {rest > 0 && (
              <Tooltip title={doctor.hospital_names.slice(3).join(', ')}>
                <Chip
                  size="small"
                  label={`+${rest}`}
                  sx={{ height: 22, fontSize: 11 }}
                />
              </Tooltip>
            )}
          </Stack>
        )}
        <Stack direction="row" spacing={0.75} alignItems="center" mt={0.5}>
          <Typography fontSize={11} color="text.secondary">
            {doctor.hospitals_count} hospital(is) · {doctor.expertises_count}{' '}
            especialidade(s)
          </Typography>
          {doctor.hospitals_pending > 0 && (
            <Tooltip title="A organização solicitou o vínculo, mas o hospital ainda não autorizou. Até lá o médico não entra na escala.">
              <Chip
                size="small"
                icon={<HourglassTopIcon sx={{ fontSize: 12 }} />}
                label={`${doctor.hospitals_pending} aguardando hospital`}
                color="warning"
                variant="outlined"
                sx={{ height: 19, fontSize: 10, fontWeight: 600 }}
              />
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Button
        variant={doctor.hospitals_count === 0 ? 'contained' : 'outlined'}
        size="small"
        startIcon={<AccountTreeIcon />}
        onClick={onManage}
        sx={{ flexShrink: 0 }}
      >
        Gerenciar vínculos
      </Button>
    </Paper>
  );
}

export default function DoctorLinks() {
  const { current } = useEnterprise();
  const [searchParams, setSearchParams] = useSearchParams();

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get<DoctorListItem[]>(
        `/enterprise/${current.id}/doctors`,
      );
      setDoctors(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar os credenciados.',
      );
    } finally {
      setLoading(false);
    }
  }, [current?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link vindo do Credenciamento: /vinculos?user=<id>
  useEffect(() => {
    const user = searchParams.get('user');
    if (!user) return;
    setSelectedUserId(user);
    const next = new URLSearchParams(searchParams);
    next.delete('user');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return doctors.filter(doctor => {
      if (filter === 'unlinked' && doctor.hospitals_count > 0) return false;
      if (filter === 'pending' && doctor.hospitals_pending === 0) return false;
      if (filter === 'linked' && doctor.hospitals_count === 0) return false;
      if (!q) return true;
      return (
        norm(doctor.name || '').includes(q) ||
        norm(doctor.email || '').includes(q) ||
        norm(doctor.crm || '').includes(q)
      );
    });
  }, [doctors, search, filter]);

  const unlinkedCount = useMemo(
    () => doctors.filter(d => d.hospitals_count === 0).length,
    [doctors],
  );

  const pendingCount = useMemo(
    () => doctors.filter(d => d.hospitals_pending > 0).length,
    [doctors],
  );

  return (
    <PrivateLayout>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={2.5}
        flexWrap="wrap"
        gap={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Vínculos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Defina em quais hospitais e especialidades cada credenciado atua.
            {unlinkedCount > 0 && <> · {unlinkedCount} sem vínculo</>}
            {pendingCount > 0 && (
              <> · {pendingCount} aguardando autorização do hospital</>
            )}
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ sm: 'center' }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <TextField
            size="small"
            placeholder="Buscar por nome, e-mail ou CRM"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: { sm: 280 }, bgcolor: '#fff' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#64748b' }} />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_e, v: Filter | null) => v && setFilter(v)}
            sx={{ bgcolor: '#fff' }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton value="unlinked">Sem vínculo</ToggleButton>
            <ToggleButton value="pending">Aguardando hospital</ToggleButton>
            <ToggleButton value="linked">Vinculados</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadingIcon />}
            onClick={() => setImportOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Puxar dos hospitais
          </Button>
          <IconButton onClick={load} disabled={loading} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {loading ? (
        <Stack spacing={1.25}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={78} />
          ))}
        </Stack>
      ) : filtered.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            border: `1px dashed ${BORDER}`,
            borderRadius: 3,
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 40, color: '#64748b', mb: 1 }} />
          <Typography fontSize={15} fontWeight={600}>
            {doctors.length === 0
              ? 'Nenhum credenciado aprovado'
              : 'Nenhum credenciado encontrado'}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            {doctors.length === 0
              ? 'Aprove um cadastro em Credenciamento — ou puxe quem já trabalha nos hospitais da organização.'
              : 'Tente ajustar a busca ou o filtro.'}
          </Typography>
          {doctors.length === 0 && (
            <Button
              variant="contained"
              startIcon={<DownloadingIcon />}
              onClick={() => setImportOpen(true)}
              sx={{ mt: 2 }}
            >
              Puxar médicos dos hospitais
            </Button>
          )}
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {filtered.map(doctor => (
            <DoctorRow
              key={doctor.id}
              doctor={doctor}
              onManage={() => setSelectedUserId(doctor.id)}
            />
          ))}
        </Stack>
      )}

      <AssignmentsDialog
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onSaved={load}
      />

      <ImportDoctorsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </PrivateLayout>
  );
}
