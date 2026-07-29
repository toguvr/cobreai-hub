import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';

interface Benefit {
  id: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
  enterprise_site: string | null;
  enterprise_logo_url: string | null;
  image_url: string | null;
  link_on_click: string | null;
  title: string | null;
  description: string | null;
  buttonTitle: string | null;
  discount: boolean | null;
  active: boolean | null;
  clicks: number | null;
  created_at: string;
}

interface FormState {
  enterprise_name: string;
  enterprise_site: string;
  title: string;
  description: string;
  link_on_click: string;
  buttonTitle: string;
  discount: boolean;
  active: boolean;
  image?: File | null;
  logo?: File | null;
}

const EMPTY_FORM: FormState = {
  enterprise_name: '',
  enterprise_site: '',
  title: '',
  description: '',
  link_on_click: '',
  buttonTitle: 'Consultar',
  discount: false,
  active: true,
  image: null,
  logo: null,
};

export default function Benefits() {
  const { current } = useEnterprise();
  const [items, setItems] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Benefit | null>(null);

  const load = useCallback(async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get<Benefit[]>(
        `/enterprise/${current.id}/benefits`,
      );
      setItems(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao carregar benefícios.',
      );
    } finally {
      setLoading(false);
    }
  }, [current?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (b: Benefit) => {
    setEditing(b);
    setForm({
      enterprise_name: b.enterprise_name ?? '',
      enterprise_site: b.enterprise_site ?? '',
      title: b.title ?? '',
      description: b.description ?? '',
      link_on_click: b.link_on_click ?? '',
      buttonTitle: b.buttonTitle ?? 'Consultar',
      discount: !!b.discount,
      active: b.active !== false,
      image: null,
      logo: null,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!current?.id) return;
    if (!form.title.trim()) {
      toast.warning('Título é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('enterprise_name', form.enterprise_name.trim());
      fd.append('enterprise_site', form.enterprise_site.trim());
      fd.append('title', form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('link_on_click', form.link_on_click.trim());
      fd.append('buttonTitle', form.buttonTitle.trim());
      fd.append('discount', String(form.discount));
      fd.append('active', String(form.active));
      if (form.image) fd.append('image', form.image);
      if (form.logo) fd.append('logo', form.logo);

      if (editing) {
        await api.put(
          `/enterprise/${current.id}/benefits/${editing.id}`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        toast.success('Benefício atualizado.');
      } else {
        await api.post(`/enterprise/${current.id}/benefits`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Benefício criado.');
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao salvar. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Benefit) => {
    if (!current?.id) return;
    // Otimista: atualiza UI e reverte se der ruim.
    const newActive = b.active === false ? true : false;
    setItems(prev =>
      prev.map(i => (i.id === b.id ? { ...i, active: newActive } : i)),
    );
    try {
      const fd = new FormData();
      fd.append('active', String(newActive));
      await api.put(`/enterprise/${current.id}/benefits/${b.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao atualizar. Tente novamente.',
      );
      setItems(prev =>
        prev.map(i => (i.id === b.id ? { ...i, active: b.active } : i)),
      );
    }
  };

  const remove = async () => {
    if (!confirmDelete || !current?.id) return;
    try {
      await api.delete(
        `/enterprise/${current.id}/benefits/${confirmDelete.id}`,
      );
      toast.success('Benefício removido.');
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover.');
    }
  };

  return (
    <PrivateLayout>
      <Box p={{ xs: 2, md: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          gap={2}
          mb={3}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Benefícios
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              Parcerias e vantagens que aparecem no app dos médicos vinculados
              à empresa.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Novo benefício
          </Button>
        </Stack>

        {loading ? (
          <Box p={4} display="flex" justifyContent="center">
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Nenhum benefício cadastrado. Clique em <b>Novo benefício</b> pra
              adicionar o primeiro.
            </Typography>
          </Paper>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns={{
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
            }}
            gap={2}
          >
            {items.map(b => (
              <Paper
                key={b.id}
                variant="outlined"
                sx={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: b.active === false ? 0.55 : 1,
                }}
              >
                {b.image_url ? (
                  <Box
                    component="img"
                    src={b.image_url}
                    alt={b.title ?? ''}
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      objectFit: 'cover',
                      bgcolor: '#f1f5f9',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: '16/9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#f1f5f9',
                      color: 'text.secondary',
                      fontSize: 13,
                    }}
                  >
                    (sem imagem)
                  </Box>
                )}
                <Box p={2} flex={1} display="flex" flexDirection="column" gap={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {b.enterprise_logo_url && (
                      <Box
                        component="img"
                        src={b.enterprise_logo_url}
                        alt=""
                        sx={{ height: 24, borderRadius: 0.5 }}
                      />
                    )}
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      {b.enterprise_name || 'parceiro'}
                    </Typography>
                  </Stack>
                  <Typography fontWeight={700} fontSize={15} noWrap>
                    {b.title || '(sem título)'}
                  </Typography>
                  <Typography
                    fontSize={13}
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {b.description}
                  </Typography>
                  <Box flex={1} />
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    mt={1}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={b.active !== false}
                          onChange={() => toggleActive(b)}
                        />
                      }
                      label={
                        <Typography fontSize={11}>
                          {b.active === false ? 'inativo' : 'ativo'}
                        </Typography>
                      }
                    />
                    <Stack direction="row">
                      {b.link_on_click && (
                        <Tooltip title="Abrir link">
                          <IconButton
                            size="small"
                            component="a"
                            href={b.link_on_click}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(b)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDelete(b)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Dialog criar/editar */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editing ? 'Editar benefício' : 'Novo benefício'}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              label="Título"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              autoFocus
              fullWidth
              required
            />
            <TextField
              label="Descrição"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                label="Nome do parceiro"
                value={form.enterprise_name}
                onChange={e =>
                  setForm({ ...form, enterprise_name: e.target.value })
                }
                sx={{ flex: 1 }}
              />
              <TextField
                label="Site do parceiro"
                value={form.enterprise_site}
                onChange={e =>
                  setForm({ ...form, enterprise_site: e.target.value })
                }
                sx={{ flex: 1 }}
                placeholder="https://…"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                label="Link do botão"
                value={form.link_on_click}
                onChange={e =>
                  setForm({ ...form, link_on_click: e.target.value })
                }
                sx={{ flex: 2 }}
                placeholder="https://wa.me/…"
              />
              <TextField
                label="Texto do botão"
                value={form.buttonTitle}
                onChange={e =>
                  setForm({ ...form, buttonTitle: e.target.value })
                }
                sx={{ flex: 1 }}
              />
            </Stack>

            {/* Uploads */}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <FileField
                label="Imagem principal"
                current={
                  form.image?.name ||
                  (editing?.image_url ? '(imagem atual)' : undefined)
                }
                inputRef={imageInputRef}
                onPick={f => setForm({ ...form, image: f })}
              />
              <FileField
                label="Logo do parceiro"
                current={
                  form.logo?.name ||
                  (editing?.enterprise_logo_url ? '(logo atual)' : undefined)
                }
                inputRef={logoInputRef}
                onPick={f => setForm({ ...form, logo: f })}
              />
            </Stack>

            <Stack direction="row" gap={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.discount}
                    onChange={e =>
                      setForm({ ...form, discount: e.target.checked })
                    }
                  />
                }
                label="Tem desconto"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.active}
                    onChange={e =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                }
                label="Ativo"
              />
            </Stack>

            {editing && (
              <Alert severity="info">
                Enviar uma imagem/logo nova substitui a atual. Deixe em branco
                pra manter.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação delete */}
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remover benefício</DialogTitle>
        <DialogContent>
          Isso vai apagar o benefício <b>{confirmDelete?.title}</b> e as
          imagens ficam órfãs no S3. Não é possível desfazer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={remove}>
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </PrivateLayout>
  );
}

// ─── Helper file input ────────────────────────────────────────────

function FileField({
  label,
  current,
  inputRef,
  onPick,
}: {
  label: string;
  current?: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onPick: (f: File | null) => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}
    >
      <Box flex={1} minWidth={0}>
        <Typography fontSize={11} color="text.secondary" letterSpacing={0.5}>
          {label.toUpperCase()}
        </Typography>
        <Typography fontSize={13} noWrap>
          {current || '(nenhum)'}
        </Typography>
      </Box>
      <Button
        size="small"
        startIcon={<CloudUploadIcon />}
        onClick={() => inputRef.current?.click()}
      >
        Enviar
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => onPick(e.target.files?.[0] ?? null)}
      />
    </Paper>
  );
}
