import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface Props {
  enterpriseId: string;
  canEdit: boolean;
}

interface BillingSettings {
  company_name: string | null;
  cnpj: string | null;
  im: string | null;
  address: string | null;
  reply_to_email: string | null;
  retention_percent: number;
  retention_breakdown: string | null;
  service_description_template: string | null;
}

const DEFAULT_TEMPLATE =
  'PRESTAÇÃO DE SERVIÇOS MÉDICOS POR {{profissional}}, REGISTRO: {{registro}}, LOCAL: {{local}} - Competência {{comp}}, SERVIÇO: {{servico}}, QUANTIDADE: {{quantidade}}, VALOR UNITÁRIO: {{valor_unitario}}, VALOR BRUTO: {{valor_bruto}}';

export default function BillingSettingsSection({
  enterpriseId,
  canEdit,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BillingSettings | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BillingSettings>(
        `/enterprise/${enterpriseId}/billing-settings`,
      );
      setData(res.data);
    } catch {
      toast.error('Falha ao carregar dados fiscais.');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.put(`/enterprise/${enterpriseId}/billing-settings`, data);
      toast.success('Dados fiscais salvos.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof BillingSettings>(
    k: K,
    v: BillingSettings[K],
  ) => {
    setData(prev => (prev ? { ...prev, [k]: v } : prev));
  };

  return (
    <Paper
      sx={{
        p: 3,
        mb: 2,
        border: '1px solid #e8eef2',
        borderRadius: 2,
      }}
      elevation={0}
    >
      <Stack direction="row" gap={1.5} alignItems="center" mb={1}>
        <ReceiptLongIcon color="primary" />
        <Typography fontWeight={700}>Dados fiscais para NF-e</Typography>
      </Stack>
      <Typography fontSize={13} color="#64748b" mb={2}>
        Aparecem no bloco <strong>Tomador do Serviço</strong> do e-mail de
        solicitação enviado aos médicos.
      </Typography>

      {loading && !data && <CircularProgress size={20} />}

      {data && (
        <Stack gap={2}>
          <Stack direction="row" gap={2} flexWrap="wrap">
            <TextField
              size="small"
              label="Razão social"
              value={data.company_name ?? ''}
              onChange={e => set('company_name', e.target.value)}
              disabled={!canEdit}
              sx={{ flex: 2, minWidth: 260 }}
            />
            <TextField
              size="small"
              label="CNPJ"
              value={data.cnpj ?? ''}
              onChange={e => set('cnpj', e.target.value)}
              disabled={!canEdit}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField
              size="small"
              label="Inscrição Municipal (IM)"
              value={data.im ?? ''}
              onChange={e => set('im', e.target.value)}
              disabled={!canEdit}
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Stack>

          <TextField
            size="small"
            label="Endereço completo"
            value={data.address ?? ''}
            onChange={e => set('address', e.target.value)}
            disabled={!canEdit}
            fullWidth
            multiline
            minRows={2}
          />

          <TextField
            size="small"
            label="E-mail que receberá as NF-e (Reply-To)"
            value={data.reply_to_email ?? ''}
            onChange={e => set('reply_to_email', e.target.value)}
            disabled={!canEdit}
            type="email"
            fullWidth
            helperText="Também é onde o médico/contador pode responder com dúvidas."
          />

          <Divider />

          <Stack direction="row" gap={2} flexWrap="wrap">
            <TextField
              size="small"
              label="Retenção de impostos (%)"
              type="number"
              value={data.retention_percent ?? 0}
              onChange={e =>
                set('retention_percent', Number(e.target.value) || 0)
              }
              disabled={!canEdit}
              sx={{ flex: 1, minWidth: 180 }}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />
            <TextField
              size="small"
              label="Discriminação da retenção"
              value={data.retention_breakdown ?? ''}
              onChange={e => set('retention_breakdown', e.target.value)}
              disabled={!canEdit}
              placeholder="Ex.: IR 1,5% | PIS/COFINS/CSLL 4,65%"
              sx={{ flex: 2, minWidth: 260 }}
            />
          </Stack>

          <Divider />

          <Box>
            <Typography fontSize={13} fontWeight={600} mb={0.5}>
              Modelo de descrição da NF-e
            </Typography>
            <Typography fontSize={12} color="#64748b" mb={1}>
              Texto que o médico vai copiar pra descrição do serviço. Placeholders
              disponíveis:{' '}
              <code>
                {'{{profissional}} {{registro}} {{local}} {{servico}} {{comp}} {{quantidade}} {{valor_unitario}} {{valor_bruto}}'}
              </code>
            </Typography>
            <TextField
              size="small"
              multiline
              minRows={4}
              fullWidth
              value={data.service_description_template ?? ''}
              onChange={e =>
                set('service_description_template', e.target.value)
              }
              placeholder={DEFAULT_TEMPLATE}
              disabled={!canEdit}
            />
            {!data.service_description_template && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Vazio = usa o modelo padrão baseado no exemplo Dr. Plantão.
              </Alert>
            )}
          </Box>

          {canEdit && (
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving}
                startIcon={saving && <CircularProgress size={14} />}
                sx={{ textTransform: 'none' }}
              >
                Salvar dados fiscais
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
}
