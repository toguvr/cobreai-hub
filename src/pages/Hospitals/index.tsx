import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';
import api from '../../services/api';
import type { Hospital } from '../../dtos';

type FormState = Partial<Hospital> & { [key: string]: any };

const C = {
  red: '#dc2626',
  redSoft: '#fff5f5',
  border: '#e8eef2',
  borderSoft: '#f1f5f9',
  textMuted: '#64748b',
  surface: '#ffffff',
};

// ─── Row de hospital com menu kebab ────────────────────────────────────────

function HospitalRow({
  hospital,
  onOpenDetail,
  onEdit,
  onUnlink,
  onDelete,
}: {
  hospital: Hospital;
  onOpenDetail: () => void;
  onEdit: () => void;
  onUnlink: () => void;
  onDelete: () => void;
}) {
  const brand = useBrand();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <TableRow hover>
      <TableCell sx={{ width: 56 }}>
        <Avatar
          src={hospital.logo_url}
          variant="rounded"
          sx={{ width: 36, height: 36, bgcolor: brand.primarySoft }}
        >
          <LocalHospitalIcon sx={{ color: brand.primary, fontSize: 18 }} />
        </Avatar>
      </TableCell>
      <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>
        {hospital.name}
      </TableCell>
      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
        {[hospital.cidade, hospital.uf].filter(Boolean).join(' / ') || '—'}
      </TableCell>
      <TableCell sx={{ fontSize: 12 }}>
        {hospital.min_hours != null ? `${hospital.min_hours}h` : '—'}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Ver detalhes">
          <IconButton size="small" onClick={onOpenDetail} sx={{ color: brand.primary }}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          PaperProps={{ sx: { minWidth: 200 } }}
        >
          <MenuItem onClick={() => { setAnchor(null); onEdit(); }}>
            <EditIcon sx={{ fontSize: 16, mr: 1.25, color: C.textMuted }} />
            <Typography fontSize={13}>Editar</Typography>
          </MenuItem>
          <MenuItem onClick={() => { setAnchor(null); onUnlink(); }}>
            <LinkOffIcon sx={{ fontSize: 16, mr: 1.25, color: C.textMuted }} />
            <Typography fontSize={13}>Desvincular da org</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setAnchor(null); onDelete(); }} sx={{ color: C.red }}>
            <DeleteIcon sx={{ fontSize: 16, mr: 1.25 }} />
            <Typography fontSize={13}>Excluir hospital</Typography>
          </MenuItem>
        </Menu>
      </TableCell>
    </TableRow>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

export default function Hospitals() {
  const navigate = useNavigate();
  const { current } = useEnterprise();
  const brand = useBrand();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Add dialog — apenas cadastro de hospital novo (vínculo de hospital
  // existente foi removido: a empresa não vincula hospitais).
  const [addOpen, setAddOpen] = useState(false);

  // Cadastrar novo
  const [form, setForm] = useState<FormState>({});
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [savingForm, setSavingForm] = useState(false);

  // Confirmações
  const [unlinkItem, setUnlinkItem] = useState<Hospital | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Hospital | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/enterprise/${current.id}/hospitals`);
      setHospitals(res.data);
    } catch {
      toast.error('Erro ao buscar hospitais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [current?.id]);

  const openAdd = () => {
    setForm({});
    setEditMode('create');
    setAddOpen(true);
  };

  const openEdit = (h: Hospital) => {
    setForm({ ...h });
    setEditMode('edit');
    setAddOpen(true);
  };

  const filteredHospitals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hospitals;
    return hospitals.filter(h =>
      (h.name || '').toLowerCase().includes(q) ||
      (h.cidade || '').toLowerCase().includes(q) ||
      (h.uf || '').toLowerCase().includes(q),
    );
  }, [hospitals, search]);

  const getCep = async () => {
    if (!form.cep || String(form.cep).replace(/\D/g, '').length < 8) return;
    try {
      const res = await axios.get(
        `https://viacep.com.br/ws/${String(form.cep).replace(/\D/g, '')}/json/`,
      );
      const { bairro, complemento, localidade, logradouro, uf } = res.data;
      setForm(prev => ({ ...prev, bairro, complemento, cidade: localidade, logradouro, uf }));
    } catch {}
  };

  const handleSaveForm = async () => {
    setSavingForm(true);
    try {
      if (editMode === 'create') {
        // Backend cria o hospital + o vínculo automaticamente quando enterprise_id vem no body
        await api.post('/hospital', { ...form, enterprise_id: current?.id });
        toast.success('Hospital criado e vinculado!');
      } else {
        await api.put('/hospital', { ...form, hospital_id: form.id });
        toast.success('Hospital atualizado!');
      }
      setAddOpen(false);
      load();
    } catch {
      toast.error('Erro ao salvar hospital.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkItem || !current?.id) return;
    setUnlinking(true);
    try {
      await api.delete(
        `/enterprise-hospital/by-pair/${current.id}/${unlinkItem.id}`,
      );
      toast.success('Hospital desvinculado da organização.');
      setUnlinkItem(null);
      load();
    } catch {
      toast.error('Erro ao desvincular.');
    } finally {
      setUnlinking(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await api.delete(`/hospital/${deleteItem.id}`);
      toast.success('Hospital excluído.');
      setDeleteItem(null);
      load();
    } catch {
      toast.error('Erro ao excluir hospital.');
    } finally {
      setDeleting(false);
    }
  };

  const field = (key: string) => ({
    value: form[key] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <PrivateLayout>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Hospitais
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {current?.title} · {hospitals.length} {hospitals.length === 1 ? 'hospital vinculado' : 'hospitais vinculados'}
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <TextField
            size="small"
            placeholder="Buscar por nome ou cidade"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: { sm: 280 }, bgcolor: C.surface }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: C.textMuted }} />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Adicionar
          </Button>
        </Stack>
      </Box>

      {/* Tabela */}
      <Paper elevation={0} sx={{ border: `1px solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
        {loading ? (
          <Box p={2}>
            <Stack spacing={1}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={56} />
              ))}
            </Stack>
          </Box>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell />
                {['Hospital', 'Cidade / UF', 'Mín. horas'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {h}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    {search ? 'Nenhum hospital encontrado.' : 'Nenhum hospital vinculado a esta organização.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredHospitals.map(h => (
                  <HospitalRow
                    key={h.id}
                    hospital={h}
                    onOpenDetail={() => navigate(`/hospitais/${h.id}`)}
                    onEdit={() => openEdit(h)}
                    onUnlink={() => setUnlinkItem(h)}
                    onDelete={() => setDeleteItem(h)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Modal Adicionar / Editar hospital */}
      <Dialog
        open={addOpen}
        onClose={() => !savingForm && setAddOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>
          {editMode === 'edit' ? 'Editar hospital' : 'Cadastrar hospital'}
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(
            <>
              <TextField label="Nome do hospital" size="small" fullWidth {...field('name')} autoFocus />
              <Box display="flex" gap={2}>
                <TextField label="Mín. horas" size="small" type="number" fullWidth {...field('min_hours')} />
                <TextField label="Tolerância (min)" size="small" type="number" fullWidth {...field('min_tolerance')} />
              </Box>
              <TextField label="CEP" size="small" fullWidth {...field('cep')} onBlur={getCep} />
              <TextField label="Rua" size="small" fullWidth {...field('logradouro')} />
              <Box display="flex" gap={2}>
                <TextField label="Número" size="small" fullWidth {...field('numero')} />
                <TextField label="Complemento" size="small" fullWidth {...field('complemento')} />
              </Box>
              <TextField label="Bairro" size="small" fullWidth {...field('bairro')} />
              <Box display="flex" gap={2}>
                <TextField label="Cidade" size="small" fullWidth {...field('cidade')} />
                <TextField label="UF" size="small" sx={{ maxWidth: 80 }} {...field('uf')} />
              </Box>
            </>
          )}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setAddOpen(false)} disabled={savingForm}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveForm}
            disabled={savingForm}
            startIcon={savingForm ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {editMode === 'edit' ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar desvincular */}
      <Dialog open={!!unlinkItem} onClose={() => !unlinking && setUnlinkItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Desvincular hospital?</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <Avatar
              src={unlinkItem?.logo_url}
              variant="rounded"
              sx={{ width: 36, height: 36, bgcolor: brand.primarySoft }}
            >
              <LocalHospitalIcon sx={{ color: brand.primary, fontSize: 18 }} />
            </Avatar>
            <Box>
              <Typography fontSize={13} fontWeight={600}>
                {unlinkItem?.name}
              </Typography>
              <Typography fontSize={11} color="text.secondary">
                {[unlinkItem?.cidade, unlinkItem?.uf].filter(Boolean).join(' / ') || '—'}
              </Typography>
            </Box>
          </Box>
          <Typography fontSize={13} color="text.secondary">
            O hospital deixará de aparecer nesta organização. Os dados não são apagados — outras organizações continuam tendo acesso e o vínculo pode ser refeito a qualquer momento.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUnlinkItem(null)} disabled={unlinking}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleUnlink}
            disabled={unlinking}
            startIcon={unlinking ? <CircularProgress size={14} color="inherit" /> : <LinkOffIcon sx={{ fontSize: 16 }} />}
          >
            Desvincular
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar exclusão (cascata, mais grave) */}
      <Dialog open={!!deleteItem} onClose={() => !deleting && setDeleteItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ color: C.red }}>Excluir hospital?</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={2}>
            <Avatar
              src={deleteItem?.logo_url}
              variant="rounded"
              sx={{ width: 36, height: 36, bgcolor: C.redSoft }}
            >
              <LocalHospitalIcon sx={{ color: C.red, fontSize: 18 }} />
            </Avatar>
            <Box>
              <Typography fontSize={13} fontWeight={600}>
                {deleteItem?.name}
              </Typography>
              <Typography fontSize={11} color="text.secondary">
                {[deleteItem?.cidade, deleteItem?.uf].filter(Boolean).join(' / ') || '—'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: C.redSoft, borderRadius: 2, border: `1px solid #fecaca` }}>
            <Typography fontSize={12} color={C.red} fontWeight={600} mb={0.5}>
              ⚠️ Ação irreversível
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              O hospital será removido do sistema, junto com todos os plantões, médicos vinculados e dados financeiros. <strong>Outras organizações também perderão acesso.</strong> Para apenas remover desta organização, use <strong>Desvincular</strong>.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteItem(null)} disabled={deleting}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Excluir definitivamente
          </Button>
        </DialogActions>
      </Dialog>
    </PrivateLayout>
  );
}
