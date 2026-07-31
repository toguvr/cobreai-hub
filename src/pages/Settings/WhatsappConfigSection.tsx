import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';

import api from '../../services/api';

/**
 * Config do WhatsApp Cloud API por empresa. UNIQUE por enterprise_id
 * no back, então mesmo que a rota tenha /:config_id, na prática só há
 * 1 config viva por empresa. Componente trata como "objeto ou null".
 *
 * access_token_encrypted é gravado com AES-256 (WHATSAPP_TOKEN_
 * ENCRYPTION_KEY) e nunca volta no GET — o campo do form fica em
 * branco depois de salvar; enviar branco no PATCH não altera; enviar
 * novo substitui.
 */

interface WhatsappConfig {
  id: string;
  enterprise_id: string;
  phone_number_id: string;
  waba_id: string;
  confirmation_template_name: string | null;
  confirmation_template_language: string;
  exam_template_name: string | null;
  exam_template_language: string;
  encryption_key_version: number;
  token_updated_at: string;
  created_at: string;
  updated_at: string;
}

interface FormState {
  access_token: string;
  phone_number_id: string;
  waba_id: string;
  confirmation_template_name: string;
  confirmation_template_language: string;
  exam_template_name: string;
  exam_template_language: string;
}

const EMPTY_FORM: FormState = {
  access_token: '',
  phone_number_id: '',
  waba_id: '',
  confirmation_template_name: '',
  confirmation_template_language: 'pt_BR',
  exam_template_name: '',
  exam_template_language: 'pt_BR',
};

const C = {
  border: '#e8eef2',
  textMuted: '#64748b',
  surface: '#ffffff',
};

export default function WhatsappConfigSection({
  enterpriseId,
  canEdit,
}: {
  enterpriseId: string;
  canEdit: boolean;
}) {
  const [config, setConfig] = useState<WhatsappConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<WhatsappConfig[]>(
        `/enterprise/${enterpriseId}/whatsapp-config`,
      );
      const first = (res.data ?? [])[0] ?? null;
      setConfig(first);
      setForm({
        access_token: '',
        phone_number_id: first?.phone_number_id ?? '',
        waba_id: first?.waba_id ?? '',
        confirmation_template_name: first?.confirmation_template_name ?? '',
        confirmation_template_language:
          first?.confirmation_template_language ?? 'pt_BR',
        exam_template_name: first?.exam_template_name ?? '',
        exam_template_language: first?.exam_template_language ?? 'pt_BR',
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao carregar configuração do WhatsApp.',
      );
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.phone_number_id.trim() || !form.waba_id.trim()) {
      toast.warning('Phone Number ID e WABA ID são obrigatórios.');
      return;
    }
    if (
      !form.confirmation_template_name.trim() &&
      !form.exam_template_name.trim()
    ) {
      toast.warning(
        'Configure ao menos um template (confirmação de plantão ou envio de exame).',
      );
      return;
    }
    // Criar: token obrigatório. Atualizar: token opcional (não mandado
    // significa "mantém o que está").
    if (!config && !form.access_token.trim()) {
      toast.warning('Access token é obrigatório na primeira configuração.');
      return;
    }

    setSaving(true);
    try {
      const bodyBase: Record<string, string | undefined> = {
        phone_number_id: form.phone_number_id.trim(),
        waba_id: form.waba_id.trim(),
        confirmation_template_name:
          form.confirmation_template_name.trim() || undefined,
        confirmation_template_language: form.confirmation_template_language,
        exam_template_name: form.exam_template_name.trim() || undefined,
        exam_template_language: form.exam_template_language,
      };
      // Só inclui access_token se o admin digitou algo — evita
      // sobrescrever com string vazia.
      if (form.access_token.trim()) {
        bodyBase.access_token = form.access_token.trim();
      }

      if (config) {
        await api.patch(
          `/enterprise/${enterpriseId}/whatsapp-config`,
          bodyBase,
        );
        toast.success('Configuração do WhatsApp atualizada.');
      } else {
        // Create exige access_token — já validado acima.
        await api.post(
          `/enterprise/${enterpriseId}/whatsapp-config`,
          bodyBase,
        );
        toast.success('Configuração do WhatsApp criada.');
      }
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          'Erro ao salvar configuração. Verifique os campos.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!config) return;
    if (
      !window.confirm(
        'Remover a configuração do WhatsApp desta empresa? Os envios (confirmação de plantão, exames) vão parar até você configurar de novo.',
      )
    )
      return;
    setDeleting(true);
    try {
      await api.delete(`/enterprise/${enterpriseId}/whatsapp-config`);
      toast.success('Configuração removida.');
      setConfig(null);
      setForm({ ...EMPTY_FORM });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover.');
    } finally {
      setDeleting(false);
    }
  };

  const hasStoredToken = !!config;

  return (
    <Paper
      sx={{ p: 2, mb: 2, border: `1px solid ${C.border}`, bgcolor: C.surface }}
      elevation={0}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        mb={1.5}
      >
        <Box>
          <Typography fontWeight={700} fontSize={14}>
            WhatsApp Cloud API
          </Typography>
          <Typography fontSize={11} color={C.textMuted}>
            Access token, WABA e templates usados nas confirmações de
            plantão e envios de exame por WhatsApp.
          </Typography>
        </Box>
        {config && canEdit && (
          <Button
            size="small"
            color="error"
            onClick={remove}
            disabled={deleting || saving}
          >
            {deleting ? 'Removendo…' : 'Remover configuração'}
          </Button>
        )}
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <Stack gap={2}>
          {config ? (
            <Alert severity="success">
              Configuração ativa desde{' '}
              {new Date(config.token_updated_at).toLocaleString('pt-BR')}. O
              access token não é exibido — deixe em branco pra mantê-lo, ou
              cole um novo pra substituir.
            </Alert>
          ) : (
            <Alert severity="info">
              Nenhuma configuração ativa. Preencha os campos abaixo pra
              habilitar os envios de WhatsApp desta empresa.
            </Alert>
          )}

          <TextField
            size="small"
            fullWidth
            type="password"
            label={
              hasStoredToken
                ? 'Access Token (deixe em branco pra manter)'
                : 'Access Token (obrigatório)'
            }
            value={form.access_token}
            onChange={e => setForm({ ...form, access_token: e.target.value })}
            disabled={!canEdit || saving}
            placeholder={
              hasStoredToken
                ? '••••••••••••'
                : 'Cole o token permanente da conta Meta Business'
            }
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              size="small"
              fullWidth
              label="Phone Number ID"
              value={form.phone_number_id}
              onChange={e =>
                setForm({
                  ...form,
                  phone_number_id: e.target.value.replace(/\D/g, ''),
                })
              }
              disabled={!canEdit || saving}
              inputProps={{ inputMode: 'numeric', maxLength: 64 }}
              helperText="ID do número do WhatsApp Business (só dígitos)."
            />
            <TextField
              size="small"
              fullWidth
              label="WABA ID"
              value={form.waba_id}
              onChange={e =>
                setForm({
                  ...form,
                  waba_id: e.target.value.replace(/\D/g, ''),
                })
              }
              disabled={!canEdit || saving}
              inputProps={{ inputMode: 'numeric', maxLength: 64 }}
              helperText="WhatsApp Business Account ID."
            />
          </Stack>

          <Box>
            <Typography fontSize={12} fontWeight={600} mb={1}>
              Template de confirmação de plantão
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                size="small"
                fullWidth
                label="Nome do template"
                value={form.confirmation_template_name}
                onChange={e =>
                  setForm({
                    ...form,
                    confirmation_template_name: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ''),
                  })
                }
                disabled={!canEdit || saving}
                placeholder="confirmacao_de_plantao"
                inputProps={{ maxLength: 512 }}
                helperText="Só a-z, 0-9 e underscore."
              />
              <TextField
                size="small"
                label="Idioma"
                value={form.confirmation_template_language}
                onChange={e =>
                  setForm({
                    ...form,
                    confirmation_template_language: e.target.value,
                  })
                }
                disabled={!canEdit || saving}
                placeholder="pt_BR"
                sx={{ minWidth: 120 }}
                inputProps={{ maxLength: 5 }}
                helperText="Ex: pt_BR"
              />
            </Stack>
          </Box>

          <Box>
            <Typography fontSize={12} fontWeight={600} mb={1}>
              Template de envio de exame
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                size="small"
                fullWidth
                label="Nome do template"
                value={form.exam_template_name}
                onChange={e =>
                  setForm({
                    ...form,
                    exam_template_name: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ''),
                  })
                }
                disabled={!canEdit || saving}
                placeholder="envio_exame"
                inputProps={{ maxLength: 512 }}
                helperText="Só a-z, 0-9 e underscore."
              />
              <TextField
                size="small"
                label="Idioma"
                value={form.exam_template_language}
                onChange={e =>
                  setForm({
                    ...form,
                    exam_template_language: e.target.value,
                  })
                }
                disabled={!canEdit || saving}
                placeholder="pt_BR"
                sx={{ minWidth: 120 }}
                inputProps={{ maxLength: 5 }}
                helperText="Ex: pt_BR"
              />
            </Stack>
          </Box>

          <Typography fontSize={11} color={C.textMuted}>
            Pelo menos um dos dois templates precisa estar preenchido — o
            back exige ao menos um pra aceitar a configuração.
          </Typography>

          {canEdit && (
            <Stack direction="row" gap={1}>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving || deleting}
              >
                {saving
                  ? 'Salvando…'
                  : config
                  ? 'Salvar alterações'
                  : 'Criar configuração'}
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
}
