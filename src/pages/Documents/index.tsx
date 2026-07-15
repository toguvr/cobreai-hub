import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';

interface DocType {
  id: string;
  enterprise_id: string;
  name: string;
  required: boolean;
}

/**
 * CRUD dos tipos de documento exigidos no credenciamento da empresa.
 * A flag `required` bloqueia o submit do formulário público quando
 * o médico não envia o arquivo — o back também valida por segurança.
 */
export default function Documents() {
  const { current } = useEnterprise();
  const [items, setItems] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<DocType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<DocType | null>(null);

  const load = async () => {
    if (!current?.id) return;
    setLoading(true);
    try {
      const res = await api.get<DocType[]>(
        `/enterprise/${current.id}/document-types`,
      );
      setItems(res.data ?? []);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao carregar tipos de documento.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setRequired(false);
    setDialogOpen(true);
  };

  const openEdit = (item: DocType) => {
    setEditing(item);
    setName(item.name);
    setRequired(item.required);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.warning('Informe um nome para o tipo.');
      return;
    }
    if (!current?.id) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(
          `/enterprise/${current.id}/document-types/${editing.id}`,
          { name: name.trim(), required },
        );
        toast.success('Tipo de documento atualizado.');
      } else {
        await api.post(`/enterprise/${current.id}/document-types`, {
          name: name.trim(),
          required,
        });
        toast.success('Tipo de documento criado.');
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao salvar. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Toggle inline pra não obrigar o admin a abrir modal só pra
  // marcar/desmarcar required.
  const toggleRequired = async (item: DocType) => {
    if (!current?.id) return;
    // Otimista: atualiza UI e reverte se der ruim.
    setItems(prev =>
      prev.map(i => (i.id === item.id ? { ...i, required: !i.required } : i)),
    );
    try {
      await api.put(`/enterprise/${current.id}/document-types/${item.id}`, {
        required: !item.required,
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao atualizar obrigatório.',
      );
      setItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, required: item.required } : i)),
      );
    }
  };

  const remove = async () => {
    if (!confirmDelete || !current?.id) return;
    try {
      await api.delete(
        `/enterprise/${current.id}/document-types/${confirmDelete.id}`,
      );
      toast.success('Tipo de documento removido.');
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao remover.',
      );
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
              Documentos exigidos no credenciamento
            </Typography>
            <Typography color="text.secondary" fontSize={14}>
              Defina os tipos de documento que os médicos precisam enviar
              ao se cadastrar. Marque como <b>obrigatório</b> os que
              bloqueiam o envio do cadastro.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Adicionar tipo
          </Button>
        </Stack>

        <Paper variant="outlined">
          {loading ? (
            <Box p={4} display="flex" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Box p={4} textAlign="center" color="text.secondary">
              Nenhum tipo cadastrado. Clique em "Adicionar tipo" pra começar.
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell align="center">Obrigatório</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={item.required}
                        onChange={() => toggleRequired(item)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(item)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDelete(item)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>

      {/* Dialog: criar/editar */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editing ? 'Editar tipo de documento' : 'Novo tipo de documento'}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              autoFocus
              label="Nome"
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              placeholder="Ex.: Diploma de graduação"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={required}
                  onChange={e => setRequired(e.target.checked)}
                />
              }
              label="Obrigatório no credenciamento"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmação de delete */}
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remover tipo</DialogTitle>
        <DialogContent>
          Isso vai apagar o tipo <b>{confirmDelete?.name}</b> e todos os
          uploads associados. Não é possível desfazer.
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
