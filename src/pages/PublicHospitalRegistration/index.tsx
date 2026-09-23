import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import axios from 'axios';

// Página PÚBLICA: quem abre não tem login no hub. Instância própria de
// axios, sem os interceptors de sessão.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
});

interface PublicInfo {
  enterprise: { id: string; title: string; logo_url?: string | null };
  label: string | null;
}

interface FormState {
  name: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  min_hours: string;
  min_tolerance: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  min_hours: '',
  min_tolerance: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
};

export default function PublicHospitalRegistration() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await publicApi.get<PublicInfo>(
          `/public/hospital-registration-link/${token}`,
        );
        if (active) setInfo(res.data);
      } catch (e: any) {
        if (active) {
          setLoadError(
            e?.response?.data?.message ||
              'Não foi possível abrir este link. Peça um novo à organização.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  const lookupCep = async () => {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    try {
      const res = await axios.get(`https://viacep.com.br/ws/${digits}/json/`);
      const { bairro, complemento, localidade, logradouro, uf } = res.data;
      setForm(prev => ({
        ...prev,
        bairro: bairro || prev.bairro,
        complemento: complemento || prev.complemento,
        cidade: localidade || prev.cidade,
        logradouro: logradouro || prev.logradouro,
        uf: uf || prev.uf,
      }));
    } catch {
      // CEP é conveniência: se o ViaCEP falhar, a pessoa digita à mão.
    }
  };

  const submit = async () => {
    setSubmitError(null);
    setSubmitting(true);

    // Campo vazio vira omissão: o backend aceita null, mas string vazia
    // em e-mail reprova na validação sem a pessoa ter digitado nada.
    const clean = (value: string) => {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    };
    const num = (value: string) => {
      const parsed = Number(value);
      return value.trim() !== '' && Number.isFinite(parsed)
        ? parsed
        : undefined;
    };

    try {
      await publicApi.post(`/public/hospital-registration-link/${token}`, {
        name: form.name.trim(),
        cep: clean(form.cep),
        logradouro: clean(form.logradouro),
        numero: clean(form.numero),
        complemento: clean(form.complemento),
        bairro: clean(form.bairro),
        cidade: clean(form.cidade),
        uf: clean(form.uf)?.toUpperCase(),
        min_hours: num(form.min_hours),
        min_tolerance: num(form.min_tolerance),
        contact_name: clean(form.contact_name),
        contact_email: clean(form.contact_email),
        contact_phone: clean(form.contact_phone),
        notes: clean(form.notes),
      });
      setDone(true);
    } catch (e: any) {
      setSubmitError(
        e?.response?.data?.message ||
          'Não foi possível enviar. Confira os dados e tente de novo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box
        minHeight="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">{loadError}</Alert>
      </Container>
    );
  }

  if (done) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 52, mb: 1 }} />
          <Typography fontSize={20} fontWeight={600} mb={1}>
            Solicitação enviada
          </Typography>
          <Typography fontSize={14} color="text.secondary">
            {info?.enterprise.title} vai analisar os dados de{' '}
            <b>{form.name}</b>. O hospital só é criado depois da aprovação —
            você não precisa enviar de novo.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const canSubmit = form.name.trim().length >= 2 && !submitting;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Stack alignItems="center" spacing={1} mb={3}>
        {info?.enterprise.logo_url ? (
          <Box
            component="img"
            src={info.enterprise.logo_url}
            alt={info.enterprise.title}
            sx={{ maxHeight: 64, maxWidth: '70%' }}
          />
        ) : (
          <LocalHospitalIcon color="primary" sx={{ fontSize: 44 }} />
        )}
        <Typography fontSize={20} fontWeight={600} textAlign="center">
          Cadastro de hospital
        </Typography>
        <Typography fontSize={14} color="text.secondary" textAlign="center">
          {info?.enterprise.title} pediu os dados deste hospital
          {info?.label ? ` (${info.label})` : ''}. Depois de enviar, um
          responsável da organização aprova e o hospital é criado.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography fontSize={13} fontWeight={600} color="text.secondary">
            DADOS DO HOSPITAL
          </Typography>

          <TextField
            label="Nome do hospital"
            size="small"
            fullWidth
            required
            autoFocus
            {...field('name')}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="CEP"
              size="small"
              fullWidth
              {...field('cep')}
              onBlur={lookupCep}
            />
            <TextField
              label="UF"
              size="small"
              sx={{ maxWidth: { sm: 100 } }}
              fullWidth
              inputProps={{ maxLength: 2 }}
              {...field('uf')}
            />
          </Stack>

          <TextField
            label="Rua"
            size="small"
            fullWidth
            {...field('logradouro')}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Número"
              size="small"
              fullWidth
              {...field('numero')}
            />
            <TextField
              label="Complemento"
              size="small"
              fullWidth
              {...field('complemento')}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Bairro"
              size="small"
              fullWidth
              {...field('bairro')}
            />
            <TextField
              label="Cidade"
              size="small"
              fullWidth
              {...field('cidade')}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Mín. horas do plantão"
              size="small"
              type="number"
              fullWidth
              {...field('min_hours')}
            />
            <TextField
              label="Tolerância (min)"
              size="small"
              type="number"
              fullWidth
              {...field('min_tolerance')}
            />
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Typography fontSize={13} fontWeight={600} color="text.secondary">
            SEU CONTATO
          </Typography>
          <Typography fontSize={12} color="text.secondary" mt={-1}>
            Para a organização falar com você se faltar alguma informação.
          </Typography>

          <TextField
            label="Seu nome"
            size="small"
            fullWidth
            {...field('contact_name')}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="E-mail"
              size="small"
              type="email"
              fullWidth
              {...field('contact_email')}
            />
            <TextField
              label="Telefone"
              size="small"
              fullWidth
              {...field('contact_phone')}
            />
          </Stack>

          <TextField
            label="Observações (opcional)"
            size="small"
            fullWidth
            multiline
            minRows={2}
            {...field('notes')}
          />

          {submitError && <Alert severity="error">{submitError}</Alert>}

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting ? 'Enviando…' : 'Enviar para aprovação'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
