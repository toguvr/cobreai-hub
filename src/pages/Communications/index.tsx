import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
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
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Step,
  StepLabel,
  Stepper,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import { toast } from 'react-toastify';
import { PrivateLayout } from '../../components/PrivateLayout';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import api from '../../services/api';
import type {
  EmailCampaign,
  EmailCampaignDetail,
  EmailCampaignSegment,
  SegmentOptions,
  SegmentPreview,
} from '../../dtos';

const C = {
  border: '#e8eef2',
  borderSoft: '#f1f5f9',
  textMuted: '#64748b',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  green: '#15803d',
  greenSoft: '#f0fdf4',
  red: '#b91c1c',
  redSoft: '#fef2f2',
  blue: '#1d4ed8',
  blueSoft: '#eff6ff',
};

const STATUS_LABEL: Record<EmailCampaign['status'], string> = {
  draft: 'Rascunho',
  sending: 'Enviando',
  sent: 'Enviada',
  partial: 'Parcial',
  failed: 'Falhou',
};

const STATUS_COLOR: Record<EmailCampaign['status'], string> = {
  draft: C.textMuted,
  sending: C.blue,
  sent: C.green,
  partial: C.amber,
  failed: C.red,
};

const AVAILABLE_VARS = [
  { key: 'nome', label: 'Nome completo' },
  { key: 'primeiro_nome', label: 'Primeiro nome' },
  { key: 'crm', label: 'CRM' },
  { key: 'especialidade', label: 'Especialidade' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'enterprise', label: 'Nome da empresa' },
];

export default function Communications() {
  const { current } = useEnterprise();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!current?.id) return;
    setLoadingList(true);
    try {
      const res = await api.get<EmailCampaign[]>(
        `/enterprise/${current.id}/email-campaigns`,
      );
      setCampaigns(res.data);
    } catch {
      toast.error('Falha ao carregar campanhas.');
    } finally {
      setLoadingList(false);
    }
  }, [current?.id]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  return (
    <PrivateLayout>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
          flexWrap="wrap"
          gap={1.5}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Comunicações
            </Typography>
            <Typography color={C.textMuted} fontSize={13}>
              Dispare e-mails segmentados para os médicos da sua empresa.
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <IconButton onClick={loadCampaigns} size="small">
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none' }}
              onClick={() => setWizardOpen(true)}
            >
              Nova campanha
            </Button>
          </Stack>
        </Stack>

        {loadingList && campaigns.length === 0 && (
          <Skeleton variant="rounded" height={200} />
        )}

        {!loadingList && campaigns.length === 0 && (
          <Paper
            sx={{
              p: 5,
              textAlign: 'center',
              border: `1px dashed ${C.border}`,
              borderRadius: 2,
            }}
          >
            <Typography color={C.textMuted} mb={1}>
              Nenhuma campanha enviada ainda.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none' }}
              onClick={() => setWizardOpen(true)}
            >
              Criar primeira campanha
            </Button>
          </Paper>
        )}

        {campaigns.length > 0 && (
          <Paper sx={{ border: `1px solid ${C.border}`, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    ASSUNTO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    STATUS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  >
                    DESTINATÁRIOS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  >
                    ENVIADOS
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  >
                    FALHAS
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    CRIADA EM
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setDetailId(c.id)}
                  >
                    <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>
                      {c.subject}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={STATUS_LABEL[c.status]}
                        sx={{
                          color: STATUS_COLOR[c.status],
                          bgcolor: `${STATUS_COLOR[c.status]}18`,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 13 }}>
                      {c.total_recipients}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 13 }}>
                      {c.sent_count}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontSize: 13,
                        color: c.failed_count > 0 ? C.red : undefined,
                      }}
                    >
                      {c.failed_count}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, color: C.textMuted }}>
                      {new Date(c.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {wizardOpen && current?.id && (
        <CampaignWizard
          enterpriseId={current.id}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            loadCampaigns();
          }}
        />
      )}

      {detailId && current?.id && (
        <CampaignDetail
          enterpriseId={current.id}
          campaignId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={loadCampaigns}
        />
      )}
    </PrivateLayout>
  );
}

// ── Wizard ────────────────────────────────────────────────────────

interface WizardProps {
  enterpriseId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CampaignWizard({ enterpriseId, onClose, onCreated }: WizardProps) {
  const [step, setStep] = useState(0);
  const [options, setOptions] = useState<SegmentOptions | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(false);

  // ── Passo 1: segmentação ──
  const [hospitals, setHospitals] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [cities, setCities] = useState<string[]>([]);
  const [expertises, setExpertises] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [onlyCredentialed, setOnlyCredentialed] = useState(true);
  const [inactiveDays, setInactiveDays] = useState<number | ''>('');
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── Passo 2: corpo ──
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // ── Passo 3: envio ──
  const [creating, setCreating] = useState(false);

  const segment: EmailCampaignSegment = useMemo(
    () => ({
      hospital_ids: hospitals.map(h => h.id),
      cities,
      expertise_ids: expertises.map(e => e.id),
      only_credentialed: onlyCredentialed,
      inactive_days: inactiveDays === '' ? null : Number(inactiveDays),
    }),
    [hospitals, cities, expertises, onlyCredentialed, inactiveDays],
  );

  // Recarrega opções quando o admin muda a seleção de hospitais.
  // Assim cidades e especialidades encolhem pra só as que existem
  // nos médicos daqueles hospitais.
  useEffect(() => {
    let alive = true;
    setLoadingOpts(true);
    const params: Record<string, string> = {};
    if (hospitals.length > 0) {
      params.hospital_ids = hospitals.map(h => h.id).join(',');
    }
    api
      .get<SegmentOptions>(
        `/enterprise/${enterpriseId}/email-campaigns/options`,
        { params },
      )
      .then(res => {
        if (!alive) return;
        setOptions(res.data);
        // Se hospitais estreitaram e alguma cidade/especialidade
        // selecionada não faz mais parte do novo universo, remove
        // silenciosamente pra não ficar filtro fantasma.
        setCities(prev =>
          prev.filter(c => res.data.cities.includes(c)),
        );
        setExpertises(prev =>
          prev.filter(e =>
            res.data.expertises.some(o => o.id === e.id),
          ),
        );
      })
      .catch(() => toast.error('Falha ao carregar opções de segmentação.'))
      .finally(() => alive && setLoadingOpts(false));
    return () => {
      alive = false;
    };
  }, [enterpriseId, hospitals]);

  // Preview reativo — debounce simples 400ms
  useEffect(() => {
    if (step !== 0) return;
    let alive = true;
    setLoadingPreview(true);
    const timer = setTimeout(() => {
      api
        .post<SegmentPreview>(
          `/enterprise/${enterpriseId}/email-campaigns/preview`,
          { segment },
        )
        .then(res => {
          if (alive) setPreview(res.data);
        })
        .catch(() => alive && setPreview({ total: 0, sample: [] }))
        .finally(() => alive && setLoadingPreview(false));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enterpriseId, segment, step]);

  const canNextFromStep0 = (preview?.total ?? 0) > 0;
  const canNextFromStep1 = subject.trim().length > 0 && body.trim().length > 0;

  const insertVariable = (key: string) => {
    setBody(prev => `${prev}{{${key}}}`);
  };

  const bodyPreview = useMemo(() => {
    const sample = preview?.sample[0];
    const vars = {
      nome: sample?.name || 'Dr. Exemplo',
      primeiro_nome: (sample?.name || 'Exemplo').split(/\s+/)[0],
      crm: sample?.crm || '000000',
      especialidade: 'Clínica Médica',
      hospital: hospitals[0]?.name || 'Hospital Exemplo',
      cidade: sample?.cidade || 'Sua cidade',
      enterprise: 'Sua empresa',
    };
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k)
        ? String((vars as Record<string, string>)[k])
        : `{{${k}}}`,
    );
  }, [body, preview?.sample, hospitals]);

  const submit = async (andSend: boolean) => {
    setCreating(true);
    try {
      const res = await api.post<EmailCampaign>(
        `/enterprise/${enterpriseId}/email-campaigns`,
        { subject: subject.trim(), body_html: body, segment },
      );
      if (andSend) {
        try {
          await api.post(
            `/enterprise/${enterpriseId}/email-campaigns/${res.data.id}/send`,
          );
          toast.success('Envio iniciado.');
        } catch {
          toast.warn(
            'Campanha criada, mas houve falha ao iniciar o envio. Você pode disparar de novo pela lista.',
          );
        }
      } else {
        toast.success('Campanha salva como rascunho.');
      }
      onCreated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Falha ao criar campanha. Revise os campos.';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onClose={creating ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
        Nova campanha
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>Segmentar</StepLabel>
          </Step>
          <Step>
            <StepLabel>Escrever</StepLabel>
          </Step>
          <Step>
            <StepLabel>Revisar &amp; enviar</StepLabel>
          </Step>
        </Stepper>

        {step === 0 && (
          <Stack gap={2}>
            <Typography fontWeight={600} fontSize={14}>
              Quem vai receber
            </Typography>
            {loadingOpts && <CircularProgress size={20} />}
            <Autocomplete
              multiple
              size="small"
              options={options?.hospitals ?? []}
              value={hospitals}
              getOptionLabel={o => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => setHospitals(v)}
              disableCloseOnSelect
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    checked={selected}
                    style={{ marginRight: 8 }}
                  />
                  {option.name}
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Hospitais"
                  placeholder="Todos os hospitais"
                />
              )}
            />
            <Autocomplete
              multiple
              size="small"
              options={options?.cities ?? []}
              value={cities}
              onChange={(_, v) => setCities(v)}
              freeSolo
              disableCloseOnSelect
              renderInput={params => (
                <TextField
                  {...params}
                  label="Cidades"
                  placeholder="Todas as cidades"
                />
              )}
            />
            <Autocomplete
              multiple
              size="small"
              options={options?.expertises ?? []}
              value={expertises}
              getOptionLabel={o => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => setExpertises(v)}
              disableCloseOnSelect
              renderOption={(props, option, { selected }) => (
                <li {...props}>
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                    checkedIcon={<CheckBoxIcon fontSize="small" />}
                    checked={selected}
                    style={{ marginRight: 8 }}
                  />
                  {option.name}
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Especialidades"
                  placeholder="Todas as especialidades"
                />
              )}
            />
            <Stack direction="row" gap={2} flexWrap="wrap">
              <TextField
                select
                size="small"
                label="Credenciamento"
                value={onlyCredentialed ? 'yes' : 'no'}
                onChange={e => setOnlyCredentialed(e.target.value === 'yes')}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="yes">Só credenciados</MenuItem>
                <MenuItem value="no">Incluir pendentes/rejeitados</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label="Inatividade (sem plantão)"
                value={inactiveDays === '' ? '' : String(inactiveDays)}
                onChange={e =>
                  setInactiveDays(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Sem filtro</MenuItem>
                <MenuItem value="30">Sem plantão há 30+ dias</MenuItem>
                <MenuItem value="60">Sem plantão há 60+ dias</MenuItem>
                <MenuItem value="90">Sem plantão há 90+ dias</MenuItem>
                <MenuItem value="180">Sem plantão há 180+ dias</MenuItem>
              </TextField>
            </Stack>

            <Divider />
            <Paper
              sx={{
                p: 2,
                bgcolor: C.blueSoft,
                border: `1px solid ${C.blue}22`,
                borderRadius: 2,
              }}
            >
              {loadingPreview ? (
                <Stack direction="row" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  <Typography fontSize={13} color={C.textMuted}>
                    Calculando…
                  </Typography>
                </Stack>
              ) : (
                <>
                  <Typography fontWeight={700} color={C.blue} mb={0.5}>
                    {preview?.total ?? 0} médico(s) atingido(s)
                  </Typography>
                  {preview && preview.total > 0 && (
                    <Typography fontSize={12} color={C.textMuted}>
                      Ex.:{' '}
                      {preview.sample
                        .map(s => `${s.name} (${s.email})`)
                        .join(', ')}
                      {preview.total > preview.sample.length && '…'}
                    </Typography>
                  )}
                </>
              )}
            </Paper>
          </Stack>
        )}

        {step === 1 && (
          <Stack gap={2}>
            <TextField
              size="small"
              label="Assunto"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              fullWidth
              inputProps={{ maxLength: 200 }}
            />
            <Box>
              <Typography fontSize={12} color={C.textMuted} mb={0.5}>
                Variáveis (clique pra inserir no corpo):
              </Typography>
              <Stack direction="row" gap={0.5} flexWrap="wrap">
                {AVAILABLE_VARS.map(v => (
                  <Chip
                    key={v.key}
                    label={`{{${v.key}}}`}
                    size="small"
                    onClick={() => insertVariable(v.key)}
                    sx={{ fontSize: 11, cursor: 'pointer' }}
                  />
                ))}
              </Stack>
            </Box>
            <TextField
              multiline
              minRows={10}
              label="Corpo do e-mail (aceita HTML)"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Olá {{primeiro_nome}}, ..."
              fullWidth
            />
            <Divider>Prévia</Divider>
            <Paper
              sx={{
                p: 2,
                border: `1px solid ${C.border}`,
                borderRadius: 2,
                minHeight: 120,
                fontSize: 13,
                lineHeight: 1.6,
                '& p, & h1, & h2, & h3, & ul, & ol': { m: 0, mb: 1 },
              }}
              dangerouslySetInnerHTML={{ __html: bodyPreview || '<em style="color:#94a3b8">A prévia aparece aqui.</em>' }}
            />
          </Stack>
        )}

        {step === 2 && (
          <Stack gap={2}>
            <Alert severity="info">
              O envio vai começar imediatamente. Você pode acompanhar o status
              na lista de campanhas.
            </Alert>
            <Paper sx={{ p: 2, border: `1px solid ${C.border}`, borderRadius: 2 }}>
              <Typography fontSize={12} color={C.textMuted}>
                ASSUNTO
              </Typography>
              <Typography fontWeight={600} mb={1}>
                {subject}
              </Typography>
              <Typography fontSize={12} color={C.textMuted}>
                DESTINATÁRIOS
              </Typography>
              <Typography fontWeight={600} mb={1}>
                {preview?.total ?? 0} médico(s)
              </Typography>
              <Typography fontSize={12} color={C.textMuted}>
                SEGMENTAÇÃO
              </Typography>
              <Typography fontSize={13} mb={1}>
                {[
                  hospitals.length > 0 &&
                    `${hospitals.length} hospital(is)`,
                  cities.length > 0 && `${cities.length} cidade(s)`,
                  expertises.length > 0 &&
                    `${expertises.length} especialidade(s)`,
                  onlyCredentialed
                    ? 'só credenciados'
                    : 'incluindo pendentes/rejeitados',
                  inactiveDays &&
                    `sem plantão há ${inactiveDays}+ dias`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'sem filtros — todos'}
              </Typography>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={creating}
          sx={{ textTransform: 'none' }}
        >
          Cancelar
        </Button>
        {step > 0 && (
          <Button
            onClick={() => setStep(step - 1)}
            disabled={creating}
            sx={{ textTransform: 'none' }}
          >
            Voltar
          </Button>
        )}
        {step === 0 && (
          <Button
            variant="contained"
            onClick={() => setStep(1)}
            disabled={!canNextFromStep0}
            sx={{ textTransform: 'none' }}
          >
            Próximo
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="contained"
            onClick={() => setStep(2)}
            disabled={!canNextFromStep1}
            sx={{ textTransform: 'none' }}
          >
            Próximo
          </Button>
        )}
        {step === 2 && (
          <>
            <Button
              onClick={() => submit(false)}
              disabled={creating}
              sx={{ textTransform: 'none' }}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="contained"
              startIcon={
                creating ? <CircularProgress size={14} /> : <SendIcon />
              }
              onClick={() => submit(true)}
              disabled={creating}
              sx={{ textTransform: 'none' }}
            >
              Enviar agora
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Detalhe da campanha ───────────────────────────────────────────

interface DetailProps {
  enterpriseId: string;
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
}

function CampaignDetail({
  enterpriseId,
  campaignId,
  onClose,
  onChanged,
}: DetailProps) {
  const [data, setData] = useState<EmailCampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<EmailCampaignDetail>(
        `/enterprise/${enterpriseId}/email-campaigns/${campaignId}`,
        { params },
      );
      setData(res.data);
    } catch {
      toast.error('Falha ao carregar campanha.');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId, campaignId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Polling automático enquanto está enviando — para na primeira
  // resposta com status final.
  useEffect(() => {
    if (data?.campaign.status !== 'sending') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [data?.campaign.status, load]);

  const send = async () => {
    setSending(true);
    try {
      await api.post(
        `/enterprise/${enterpriseId}/email-campaigns/${campaignId}/send`,
      );
      toast.success('Envio iniciado.');
      onChanged();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton size="small" onClick={onClose}>
            <ArrowBackIcon />
          </IconButton>
          <Box flex={1}>
            <Typography fontWeight={700} fontSize={15}>
              {data?.campaign.subject ?? 'Campanha'}
            </Typography>
            {data && (
              <Typography fontSize={12} color={C.textMuted}>
                Criada em{' '}
                {new Date(data.campaign.created_at).toLocaleString('pt-BR')}
              </Typography>
            )}
          </Box>
          {data?.campaign.status === 'draft' && (
            <Button
              variant="contained"
              startIcon={
                sending ? <CircularProgress size={14} /> : <SendIcon />
              }
              onClick={send}
              disabled={sending}
              sx={{ textTransform: 'none' }}
            >
              Enviar agora
            </Button>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading && !data && <Skeleton variant="rounded" height={300} />}
        {data && (
          <Stack gap={2}>
            <Stack direction="row" gap={2} flexWrap="wrap">
              {(
                [
                  ['total', 'Total', data.total_recipients, C.textMuted],
                  ['sent', 'Enviados', data.counts_by_status.sent, C.green],
                  [
                    'queued',
                    'Na fila',
                    data.counts_by_status.queued +
                      data.counts_by_status.sending,
                    C.blue,
                  ],
                  ['failed', 'Falhas', data.counts_by_status.failed, C.red],
                ] as const
              ).map(([key, label, value, color]) => (
                <Paper
                  key={key}
                  sx={{
                    p: 1.5,
                    flex: 1,
                    minWidth: 120,
                    border: `1px solid ${C.border}`,
                    borderRadius: 2,
                    cursor: key === 'total' ? 'default' : 'pointer',
                  }}
                  onClick={() =>
                    key !== 'total'
                      ? setStatusFilter(
                          key === 'queued'
                            ? statusFilter === 'queued'
                              ? ''
                              : 'queued'
                            : statusFilter === key
                              ? ''
                              : key,
                        )
                      : undefined
                  }
                >
                  <Typography fontSize={11} color={C.textMuted}>
                    {label.toUpperCase()}
                  </Typography>
                  <Typography fontSize={20} fontWeight={700} color={color}>
                    {value}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            <Stack direction="row" alignItems="center" gap={1}>
              <Typography fontSize={12} color={C.textMuted}>
                Filtrar:
              </Typography>
              {['', 'sent', 'queued', 'failed'].map(s => (
                <Chip
                  key={s || 'all'}
                  size="small"
                  label={
                    s === ''
                      ? 'Todos'
                      : s === 'sent'
                        ? 'Enviados'
                        : s === 'queued'
                          ? 'Na fila'
                          : 'Falhas'
                  }
                  onClick={() => setStatusFilter(s)}
                  variant={statusFilter === s ? 'filled' : 'outlined'}
                  color={statusFilter === s ? 'primary' : 'default'}
                />
              ))}
              <Box flex={1} />
              <Tooltip title="Recarregar">
                <IconButton size="small" onClick={load}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>

            <Paper
              sx={{
                border: `1px solid ${C.border}`,
                borderRadius: 2,
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      MÉDICO
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      E-MAIL
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      ENVIADO EM
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                      OBS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recipients.map(r => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ fontSize: 13 }}>
                        {r.name ?? '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{r.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            r.status === 'sent'
                              ? 'Enviado'
                              : r.status === 'failed'
                                ? 'Falhou'
                                : r.status === 'sending'
                                  ? 'Enviando'
                                  : r.status === 'skipped'
                                    ? 'Pulado'
                                    : 'Fila'
                          }
                          sx={{
                            fontSize: 11,
                            color:
                              r.status === 'sent'
                                ? C.green
                                : r.status === 'failed'
                                  ? C.red
                                  : C.textMuted,
                            bgcolor:
                              r.status === 'sent'
                                ? C.greenSoft
                                : r.status === 'failed'
                                  ? C.redSoft
                                  : C.borderSoft,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: C.textMuted }}>
                        {r.sent_at
                          ? new Date(r.sent_at).toLocaleString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell
                        sx={{ fontSize: 12, color: C.red, maxWidth: 280 }}
                      >
                        {r.error_message ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
