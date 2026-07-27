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
  /**
   * Fluxo antigo (link "sem dados bancários" ou rota /public/enterprise/:id
   * sem token). É o default que já existia.
   */
  required: boolean;
  /** Obrigatório em links bank_mode='pf' ou 'both'. */
  required_pf: boolean;
  /** Obrigatório em links bank_mode='pj' ou 'both'. */
  required_pj: boolean;
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
  const [requiredPf, setRequiredPf] = useState(false);
  const [requiredPj, setRequiredPj] = useState(false);
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
    setRequiredPf(false);
    setRequiredPj(false);
    setDialogOpen(true);
  };

  const openEdit = (item: DocType) => {
    setEditing(item);
    setName(item.name);
    setRequired(item.required);
    setRequiredPf(item.required_pf);
    setRequiredPj(item.required_pj);
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
      const body = {
        name: name.trim(),
        required,
        required_pf: requiredPf,
        required_pj: requiredPj,
      };
      if (editing) {
        await api.put(
          `/enterprise/${current.id}/document-types/${editing.id}`,
          body,
        );
        toast.success('Tipo de documento atualizado.');
      } else {
        await api.post(`/enterprise/${current.id}/document-types`, body);
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
  // marcar/desmarcar cada flag. `field` é required/required_pf/required_pj.
  const toggleFlag = async (
    item: DocType,
    field: 'required' | 'required_pf' | 'required_pj',
  ) => {
    if (!current?.id) return;
    const newValue = !item[field];
    // Otimista: atualiza UI e reverte se der ruim.
    setItems(prev =>
      prev.map(i => (i.id === item.id ? { ...i, [field]: newValue } : i)),
    );
    try {
      await api.put(`/enterprise/${current.id}/document-types/${item.id}`, {
        [field]: newValue,
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || 'Erro ao atualizar obrigatório.',
      );
      setItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, [field]: item[field] } : i,
        ),
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
              ao se cadastrar. Cada tipo pode ser obrigatório por modo do
              link de convite:
              {' '}
              <b>Padrão</b> (link sem dados bancários / fluxo antigo),
              {' '}
              <b>PF</b> (link Pessoa Física) e/ou
              {' '}
              <b>PJ</b> (link Pessoa Jurídica). Link "Ambos" pede o
              que estiver marcado em PF <i>ou</i> PJ.
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
                  <Tooltip title="Obrigatório no fluxo antigo / link sem dados bancários">
                    <TableCell align="center">Padrão</TableCell>
                  </Tooltip>
                  <Tooltip title="Obrigatório em links PF">
                    <TableCell align="center">PF</TableCell>
                  </Tooltip>
                  <Tooltip title="Obrigatório em links PJ">
                    <TableCell align="center">PJ</TableCell>
                  </Tooltip>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={item.required}
                        onChange={() => toggleFlag(item, 'required')}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={item.required_pf}
                        onChange={() => toggleFlag(item, 'required_pf')}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={item.required_pj}
                        onChange={() => toggleFlag(item, 'required_pj')}
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
            <Typography fontSize={12} color="text.secondary">
              Marque em quais modos de credenciamento este documento é
              obrigatório:
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={required}
                  onChange={e => setRequired(e.target.checked)}
                />
              }
              label="Padrão (link sem dados bancários)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={requiredPf}
                  onChange={e => setRequiredPf(e.target.checked)}
                />
              }
              label="Link Pessoa Física"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={requiredPj}
                  onChange={e => setRequiredPj(e.target.checked)}
                />
              }
              label="Link Pessoa Jurídica"
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
