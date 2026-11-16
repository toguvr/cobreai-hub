import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';

import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';

interface Badge {
  user_id: string;
  name_on_badge: string;
  crm: string | null;
  photo_url: string | null;
  updated_at: string;
}

/**
 * Crachás da empresa selecionada.
 *
 * Vivia no painel do Cobreai, onde a lista era de toda a plataforma. O
 * crachá é da empresa, então o painel é do hub e a lista vem escopada por
 * `current.id` — um org_admin não vê o médico de outra organização.
 */
export default function Badges() {
  const { current } = useEnterprise();
  const [itens, setItens] = useState<Badge[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    if (!current) return;

    setCarregando(true);
    try {
      const res = await api.get<Badge[]>(
        `/enterprise/${current.id}/badge-photo`,
      );
      setItens(res.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao carregar os crachás.');
    } finally {
      setCarregando(false);
    }
  }, [current]);

  // Trocar de organização na sidebar precisa recarregar a lista, senão a
  // tela segue mostrando os crachás da empresa anterior.
  useEffect(() => {
    setItens([]);
    carregar();
  }, [carregar]);

  const baixarZip = async () => {
    if (!current) return;

    setBaixando(true);
    try {
      // responseType blob: sem isso o axios trata o zip como texto e o
      // arquivo salvo chega corrompido.
      const res = await api.get(`/enterprise/${current.id}/badge-photo/export`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `crachas-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao gerar o zip.');
    } finally {
      setBaixando(false);
    }
  };

  const filtrados = itens.filter(item => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name_on_badge.toLowerCase().includes(q) ||
      (item.crm ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <PrivateLayout>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        mb={2}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Crachás
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            Fotos confirmadas pelos médicos
            {current ? ` de ${current.title}` : ''}. O zip sai com um arquivo
            por médico, nomeado “Nome no crachá - CRM.jpeg”, mais um CSV
            de-para para a gráfica.
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={carregar}
            disabled={carregando || !current}
            sx={{ flex: { xs: 1, sm: 'none' }, whiteSpace: 'nowrap' }}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={baixarZip}
            disabled={baixando || itens.length === 0}
            sx={{ flex: { xs: 1, sm: 'none' }, whiteSpace: 'nowrap' }}
          >
            {baixando ? 'Gerando...' : `Baixar zip (${itens.length})`}
          </Button>
        </Stack>
      </Stack>

      <TextField
        size="small"
        placeholder="Buscar por nome ou CRM"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        sx={{ mb: 2, maxWidth: { xs: '100%', sm: 320 } }}
        fullWidth
      />

      <Paper variant="outlined">
        {carregando ? (
          <Box p={4} display="flex" justifyContent="center">
            <CircularProgress size={24} />
          </Box>
        ) : filtrados.length === 0 ? (
          <Box p={4} textAlign="center" color="text.secondary" fontSize={14}>
            {itens.length === 0
              ? 'Nenhum médico desta organização enviou a foto do crachá ainda.'
              : 'Nenhum resultado para esta busca.'}
          </Box>
        ) : (
          <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 420 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Foto</TableCell>
                  <TableCell>Nome no crachá</TableCell>
                  <TableCell>CRM</TableCell>
                  <TableCell>Enviado em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtrados.map(item => (
                  <TableRow key={item.user_id} hover>
                    <TableCell>
                      <Avatar
                        src={item.photo_url ?? undefined}
                        alt={item.name_on_badge}
                        sx={{ width: 40, height: 40 }}
                      />
                    </TableCell>
                    <TableCell>{item.name_on_badge}</TableCell>
                    <TableCell>{item.crm ?? '—'}</TableCell>
                    <TableCell>
                      {new Date(item.updated_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </PrivateLayout>
  );
}
