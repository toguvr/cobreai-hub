import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import axios from 'axios';

// Instância axios separada — a padrão do hub injeta Authorization
// automaticamente, e esta página é pública (sem token).
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
});

interface DocType {
  id: string;
  name: string;
  required: boolean;
}

interface PublicInfo {
  enterprise: { id: string; title: string; logo_url?: string | null };
  document_types: DocType[];
}

interface FormData {
  name: string;
  email: string;
  cellphone: string;
  cpf: string;
  rg: string;
  crm: string;
  sus: string;
  birthday: string; // yyyy-mm-dd (input type=date)
  cep: string;
  street: string;
  number: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const EMPTY_FORM: FormData = {
  name: '', email: '', cellphone: '',
  cpf: '', rg: '', crm: '', sus: '', birthday: '',
  cep: '', street: '', number: '', complemento: '',
  bairro: '', cidade: '', uf: '',
};

const STEPS = ['Contato', 'Documentos pessoais', 'Endereço', 'Anexos', 'Envio'];

export default function PublicRegistration() {
  const { enterprise_id } = useParams<{ enterprise_id: string }>();

  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  // Map document_type_id → File
  const [files, setFiles] = useState<Record<string, File>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | {
    already_had_account: boolean;
  }>(null);

  // ── Fetch info pública da empresa ────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await publicApi.get<PublicInfo>(
          `/public/enterprise/${enterprise_id}/registration`,
        );
        if (!mounted) return;
        setInfo(res.data);
      } catch (e: any) {
        setLoadError(
          e?.response?.data?.message ||
            'Não foi possível carregar a página. Confirme o link.',
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [enterprise_id]);

  const requiredDocs = useMemo(
    () => (info?.document_types ?? []).filter(d => d.required),
    [info],
  );
  const optionalDocs = useMemo(
    () => (info?.document_types ?? []).filter(d => !d.required),
    [info],
  );

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const contactValid =
    form.name.trim().length > 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    form.cellphone.replace(/\D/g, '').length >= 10;

  const docsValid = requiredDocs.every(d => files[d.id]);

  const canGoNext = () => {
    if (step === 0) return contactValid;
    if (step === 3) return docsValid;
    return true;
  };

  const handleFilePick = (docTypeId: string, file: File | null) => {
    setFiles(prev => {
      const next = { ...prev };
      if (file) next[docTypeId] = file;
      else delete next[docTypeId];
      return next;
    });
  };

  const submit = async () => {
    if (!enterprise_id) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        cellphone: form.cellphone.replace(/\D/g, ''),
        cpf: form.cpf.replace(/\D/g, '') || undefined,
        rg: form.rg || undefined,
        crm: form.crm || undefined,
        sus: form.sus.replace(/\D/g, '') || undefined,
        birthday: form.birthday || undefined,
        cep: form.cep.replace(/\D/g, '') || undefined,
        street: form.street || undefined,
        number: form.number || undefined,
        complemento: form.complemento || undefined,
        bairro: form.bairro || undefined,
        cidade: form.cidade || undefined,
        uf: form.uf || undefined,
      };
      fd.append('payload', JSON.stringify(payload));

      // Um fieldname único por arquivo (o back casa pelo file_docs).
      const fileMeta: {
        enterprise_document_type_id: string;
        fieldname: string;
      }[] = [];
      Object.entries(files).forEach(([docTypeId, file], idx) => {
        const fieldname = `file_${idx}`;
        fd.append(fieldname, file);
        fileMeta.push({
          enterprise_document_type_id: docTypeId,
          fieldname,
        });
      });
      fd.append('file_docs', JSON.stringify(fileMeta));

      const res = await publicApi.post(
        `/public/enterprise/${enterprise_id}/registration`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setSubmitted({
        already_had_account: !!res.data?.already_had_account,
      });
      setStep(4);
    } catch (e: any) {
      alert(
        e?.response?.data?.message ||
          'Erro ao enviar cadastro. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (loadError || !info) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8 }}>
        <Alert severity="error">{loadError || 'Erro desconhecido.'}</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f8fafc', minHeight: '100vh', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="sm">
        <Stack alignItems="center" mb={3}>
          {info.enterprise.logo_url && (
            <Box
              component="img"
              src={info.enterprise.logo_url}
              alt={info.enterprise.title}
              sx={{ height: 56, mb: 1 }}
            />
          )}
          <Typography variant="h5" fontWeight={700} textAlign="center">
            Credenciamento — {info.enterprise.title}
          </Typography>
          <Typography color="text.secondary" fontSize={13} textAlign="center">
            Preencha seus dados e envie os documentos exigidos.
          </Typography>
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {step === 0 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Contato</Typography>
              <TextField
                label="Nome completo"
                fullWidth
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                value={form.email}
                onChange={e => set('email', e.target.value.trim())}
              />
              <TextField
                label="Celular (com DDD)"
                fullWidth
                value={form.cellphone}
                onChange={e => set('cellphone', e.target.value)}
                placeholder="(31) 99999-9999"
              />
            </Stack>
          )}

          {step === 1 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Documentos pessoais</Typography>
              <TextField
                label="CPF"
                fullWidth
                value={form.cpf}
                onChange={e => set('cpf', e.target.value)}
                placeholder="000.000.000-00"
              />
              <TextField
                label="RG"
                fullWidth
                value={form.rg}
                onChange={e => set('rg', e.target.value)}
              />
              <TextField
                label="CRM"
                fullWidth
                value={form.crm}
                onChange={e => set('crm', e.target.value)}
              />
              <TextField
                label="Cartão SUS (CNS)"
                fullWidth
                value={form.sus}
                onChange={e => set('sus', e.target.value)}
              />
              <TextField
                label="Data de nascimento"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={form.birthday}
                onChange={e => set('birthday', e.target.value)}
              />
            </Stack>
          )}

          {step === 2 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Endereço</Typography>
              <TextField
                label="CEP"
                fullWidth
                value={form.cep}
                onChange={e => set('cep', e.target.value)}
              />
              <TextField
                label="Logradouro"
                fullWidth
                value={form.street}
                onChange={e => set('street', e.target.value)}
              />
              <Stack direction="row" gap={2}>
                <TextField
                  label="Número"
                  value={form.number}
                  onChange={e => set('number', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Complemento"
                  value={form.complemento}
                  onChange={e => set('complemento', e.target.value)}
                  sx={{ flex: 2 }}
                />
              </Stack>
              <TextField
                label="Bairro"
                fullWidth
                value={form.bairro}
                onChange={e => set('bairro', e.target.value)}
              />
              <Stack direction="row" gap={2}>
                <TextField
                  label="Cidade"
                  value={form.cidade}
                  onChange={e => set('cidade', e.target.value)}
                  sx={{ flex: 2 }}
                />
                <TextField
                  label="UF"
                  value={form.uf}
                  onChange={e =>
                    set('uf', e.target.value.toUpperCase().slice(0, 2))
                  }
                  sx={{ flex: 1 }}
                />
              </Stack>
            </Stack>
          )}

          {step === 3 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Documentos exigidos</Typography>
              {requiredDocs.length === 0 && optionalDocs.length === 0 && (
                <Alert severity="info">
                  Esta empresa não exige documentos no credenciamento —
                  siga pra próxima etapa.
                </Alert>
              )}
              {[...requiredDocs, ...optionalDocs].map(doc => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  file={files[doc.id]}
                  inputRef={el => (fileInputRefs.current[doc.id] = el)}
                  onPick={file => handleFilePick(doc.id, file)}
                />
              ))}
              {!docsValid && requiredDocs.length > 0 && (
                <Alert severity="warning">
                  Envie todos os documentos marcados como obrigatórios (*).
                </Alert>
              )}
            </Stack>
          )}

          {step === 4 && submitted && (
            <Stack alignItems="center" gap={2} py={2}>
              <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
              <Typography variant="h6" textAlign="center">
                Cadastro enviado!
              </Typography>
              <Typography textAlign="center" color="text.secondary">
                {submitted.already_had_account
                  ? 'Como já existia uma conta com este e-mail, vinculamos você à empresa mantendo sua senha atual. Aguarde a aprovação — você receberá um e-mail assim que o admin analisar.'
                  : 'Aguarde a aprovação da empresa. Você receberá um e-mail com suas credenciais assim que for aprovado.'}
              </Typography>
            </Stack>
          )}

          {submitting && <LinearProgress sx={{ mt: 2 }} />}

          {step < 4 && (
            <Stack
              direction="row"
              justifyContent="space-between"
              mt={3}
              gap={1}
            >
              <Button
                disabled={step === 0 || submitting}
                onClick={() => setStep(s => Math.max(0, s - 1))}
              >
                Voltar
              </Button>
              {step < 3 ? (
                <Button
                  variant="contained"
                  disabled={!canGoNext() || submitting}
                  onClick={() => setStep(s => Math.min(3, s + 1))}
                >
                  Continuar
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  disabled={!docsValid || submitting}
                  onClick={submit}
                >
                  {submitting ? 'Enviando…' : 'Enviar cadastro'}
                </Button>
              )}
            </Stack>
          )}
        </Paper>

        <Typography
          textAlign="center"
          color="text.secondary"
          fontSize={11}
          mt={3}
        >
          Cobreai · {new Date().getFullYear()}
        </Typography>
      </Container>
    </Box>
  );
}

// ─── DocRow ────────────────────────────────────────────────────────

function DocRow({
  doc,
  file,
  inputRef,
  onPick,
}: {
  doc: DocType;
  file?: File;
  inputRef: (el: HTMLInputElement | null) => void;
  onPick: (file: File | null) => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderColor: file ? 'success.main' : undefined,
      }}
    >
      <Box flex={1} minWidth={0}>
        <Typography fontWeight={600} fontSize={14}>
          {doc.name}
          {doc.required && (
            <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>
              *
            </Box>
          )}
        </Typography>
        {file ? (
          <Typography fontSize={12} color="text.secondary" noWrap>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.secondary">
            {doc.required ? 'Obrigatório' : 'Opcional'}
          </Typography>
        )}
      </Box>
      {file ? (
        <IconButton size="small" onClick={() => onPick(null)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ) : (
        <Button
          size="small"
          startIcon={<UploadFileIcon />}
          onClick={() =>
            (
              document.querySelector<HTMLInputElement>(
                `input[data-doctype='${doc.id}']`,
              ) as HTMLInputElement | null
            )?.click()
          }
        >
          Enviar
        </Button>
      )}
      <input
        ref={inputRef}
        data-doctype={doc.id}
        type="file"
        hidden
        accept="image/*,application/pdf"
        onChange={e => onPick(e.target.files?.[0] ?? null)}
      />
    </Paper>
  );
}
