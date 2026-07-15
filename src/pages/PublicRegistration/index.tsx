import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  birthday: string; // yyyy-mm-dd
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

type FieldStatus = 'idle' | 'checking' | 'ok' | 'taken';

interface FieldErrors {
  [k: string]: string | undefined;
}

// Campos que dependem do user: quando o e-mail já existe no back, o
// user costuma ter alguns preenchidos. `missing_fields` do back indica
// o que ele ainda NÃO tem — só esses aparecem no form. Os demais
// somem porque são reaproveitados da conta.
const KNOWABLE_USER_FIELDS = [
  'cpf', 'rg', 'crm', 'sus', 'birthday', 'cellphone',
  'cep', 'street', 'number', 'bairro', 'cidade', 'uf',
] as const;
type UserField = typeof KNOWABLE_USER_FIELDS[number];

function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
) {
  const t = useRef<number | undefined>(undefined);
  return useCallback(
    (...args: A) => {
      if (t.current !== undefined) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => fn(...args), ms);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ms],
  );
}

export default function PublicRegistration() {
  const { enterprise_id } = useParams<{ enterprise_id: string }>();

  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [files, setFiles] = useState<Record<string, File>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | {
    already_had_account: boolean;
  }>(null);

  // Status de cada campo unique (feedback em tempo real)
  const [fieldStatus, setFieldStatus] = useState<
    Record<string, FieldStatus>
  >({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Se o e-mail já existe: skip dos campos que o user já tem
  const [emailFoundExisting, setEmailFoundExisting] = useState(false);
  const [emailMissingFields, setEmailMissingFields] = useState<UserField[]>(
    [...KNOWABLE_USER_FIELDS],
  );

  // Loading do viacep
  const [cepLoading, setCepLoading] = useState(false);

  // ── Fetch info pública ─────────────────────────────────────────
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
    return () => { mounted = false; };
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

  // ── Checa se um campo unique está disponível ────────────────────
  const checkField = useCallback(
    async (field: string, rawValue: string) => {
      if (!enterprise_id) return;
      const value = rawValue.trim();
      if (!value) {
        setFieldStatus(s => ({ ...s, [field]: 'idle' }));
        setFieldErrors(e => ({ ...e, [field]: undefined }));
        return;
      }
      setFieldStatus(s => ({ ...s, [field]: 'checking' }));
      try {
        const res = await publicApi.get(
          `/public/enterprise/${enterprise_id}/registration/check`,
          { params: { field, value } },
        );
        const { available, existing_user_missing_fields } = res.data as {
          available: boolean;
          existing_user_missing_fields?: string[];
        };

        if (field === 'email') {
          if (existing_user_missing_fields) {
            setEmailFoundExisting(true);
            setEmailMissingFields(
              existing_user_missing_fields.filter(
                (f): f is UserField =>
                  (KNOWABLE_USER_FIELDS as readonly string[]).includes(f),
              ),
            );
            setFieldStatus(s => ({ ...s, email: 'ok' }));
            setFieldErrors(e => ({ ...e, email: undefined }));
          } else {
            setEmailFoundExisting(false);
            setEmailMissingFields([...KNOWABLE_USER_FIELDS]);
            setFieldStatus(s => ({ ...s, email: 'ok' }));
            setFieldErrors(e => ({ ...e, email: undefined }));
          }
        } else if (!available) {
          setFieldStatus(s => ({ ...s, [field]: 'taken' }));
          setFieldErrors(e => ({
            ...e,
            [field]: 'Este valor já está em uso por outra conta.',
          }));
        } else {
          setFieldStatus(s => ({ ...s, [field]: 'ok' }));
          setFieldErrors(e => ({ ...e, [field]: undefined }));
        }
      } catch (e: any) {
        // Silencioso: se o back tá fora, deixamos o submit validar depois.
        setFieldStatus(s => ({ ...s, [field]: 'idle' }));
      }
    },
    [enterprise_id],
  );

  // ── Auto-preenche endereço via ViaCEP ───────────────────────────
  const lookupCep = useCallback(async (rawCep: string) => {
    const cep = rawCep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      const data = res.data;
      if (data.erro) {
        setFieldErrors(e => ({ ...e, cep: 'CEP não encontrado.' }));
        return;
      }
      setFieldErrors(e => ({ ...e, cep: undefined }));
      setForm(prev => ({
        ...prev,
        cep,
        street: prev.street || data.logradouro || '',
        bairro: prev.bairro || data.bairro || '',
        cidade: prev.cidade || data.localidade || '',
        uf: prev.uf || data.uf || '',
      }));
    } catch {
      // ViaCEP fora: silencioso, usuário preenche manual.
    } finally {
      setCepLoading(false);
    }
  }, []);

  const debouncedCheckField = useDebouncedCallback(checkField, 400);
  const debouncedCep = useDebouncedCallback(lookupCep, 400);

  const contactValid =
    form.name.trim().length > 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    form.cellphone.replace(/\D/g, '').length >= 10 &&
    fieldStatus.email !== 'checking' &&
    fieldStatus.cellphone !== 'taken' &&
    fieldStatus.email !== 'taken';

  const docsValid = requiredDocs.every(d => files[d.id]);

  const hasTakenField = (fields: string[]) =>
    fields.some(f => fieldStatus[f] === 'taken');

  const canGoNext = () => {
    if (step === 0) return contactValid && !hasTakenField(['email', 'cellphone']);
    if (step === 1) return !hasTakenField(['cpf', 'rg', 'crm', 'sus']);
    if (step === 3) return docsValid;
    return true;
  };

  const needsField = (f: UserField): boolean => {
    // Se não veio de conta existente, sempre pede.
    if (!emailFoundExisting) return true;
    return emailMissingFields.includes(f);
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

  const helperFor = (field: string, hintWhenChecking = 'Verificando…') => {
    const st = fieldStatus[field];
    if (st === 'checking') return hintWhenChecking;
    if (st === 'taken') return fieldErrors[field] || 'Já em uso.';
    return fieldErrors[field];
  };
  const errorFor = (field: string) => fieldStatus[field] === 'taken';

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
                onChange={e => {
                  const v = e.target.value.trim();
                  set('email', v);
                  debouncedCheckField('email', v);
                }}
                onBlur={() => checkField('email', form.email)}
                error={errorFor('email')}
                helperText={helperFor('email')}
              />
              {emailFoundExisting && (
                <Alert severity="info">
                  Já existe uma conta com este e-mail. Vamos reaproveitá-la e
                  pedir só os dados que ainda faltam.
                </Alert>
              )}
              {needsField('cellphone') && (
                <TextField
                  label="Celular (com DDD)"
                  fullWidth
                  value={form.cellphone}
                  onChange={e => {
                    set('cellphone', e.target.value);
                    debouncedCheckField('cellphone', e.target.value);
                  }}
                  onBlur={() => checkField('cellphone', form.cellphone)}
                  placeholder="(31) 99999-9999"
                  error={errorFor('cellphone')}
                  helperText={helperFor('cellphone')}
                />
              )}
            </Stack>
          )}

          {step === 1 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Documentos pessoais</Typography>

              {!needsField('cpf') && !needsField('rg') && !needsField('crm') &&
                !needsField('sus') && !needsField('birthday') && (
                <Alert severity="success">
                  Sua conta já tem esses dados. Pode ir pra próxima etapa.
                </Alert>
              )}

              {needsField('cpf') && (
                <TextField
                  label="CPF"
                  fullWidth
                  value={form.cpf}
                  onChange={e => {
                    set('cpf', e.target.value);
                    debouncedCheckField('cpf', e.target.value);
                  }}
                  onBlur={() => checkField('cpf', form.cpf)}
                  placeholder="000.000.000-00"
                  error={errorFor('cpf')}
                  helperText={helperFor('cpf')}
                />
              )}
              {needsField('rg') && (
                <TextField
                  label="RG"
                  fullWidth
                  value={form.rg}
                  onChange={e => {
                    set('rg', e.target.value);
                    debouncedCheckField('rg', e.target.value);
                  }}
                  onBlur={() => checkField('rg', form.rg)}
                  error={errorFor('rg')}
                  helperText={helperFor('rg')}
                />
              )}
              {needsField('crm') && (
                <TextField
                  label="CRM"
                  fullWidth
                  value={form.crm}
                  onChange={e => {
                    set('crm', e.target.value);
                    debouncedCheckField('crm', e.target.value);
                  }}
                  onBlur={() => checkField('crm', form.crm)}
                  error={errorFor('crm')}
                  helperText={helperFor('crm')}
                />
              )}
              {needsField('sus') && (
                <TextField
                  label="Cartão SUS (CNS)"
                  fullWidth
                  value={form.sus}
                  onChange={e => {
                    set('sus', e.target.value);
                    debouncedCheckField('sus', e.target.value);
                  }}
                  onBlur={() => checkField('sus', form.sus)}
                  error={errorFor('sus')}
                  helperText={helperFor('sus')}
                />
              )}
              {needsField('birthday') && (
                <TextField
                  label="Data de nascimento"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.birthday}
                  onChange={e => set('birthday', e.target.value)}
                />
              )}
            </Stack>
          )}

          {step === 2 && (
            <Stack gap={2}>
              <Typography fontWeight={600}>Endereço</Typography>

              {!needsField('cep') && !needsField('street') &&
                !needsField('number') && !needsField('bairro') &&
                !needsField('cidade') && !needsField('uf') && (
                <Alert severity="success">
                  Endereço da sua conta já está cadastrado. Pode ir pra próxima
                  etapa.
                </Alert>
              )}

              {needsField('cep') && (
                <TextField
                  label="CEP"
                  fullWidth
                  value={form.cep}
                  onChange={e => {
                    set('cep', e.target.value);
                    debouncedCep(e.target.value);
                  }}
                  onBlur={() => lookupCep(form.cep)}
                  placeholder="00000-000"
                  helperText={
                    cepLoading
                      ? 'Buscando endereço…'
                      : fieldErrors.cep || 'Preenche o restante automaticamente'
                  }
                  error={!!fieldErrors.cep}
                />
              )}
              {needsField('street') && (
                <TextField
                  label="Logradouro"
                  fullWidth
                  value={form.street}
                  onChange={e => set('street', e.target.value)}
                />
              )}
              {(needsField('number') || needsField('street')) && (
                <Stack direction="row" gap={2}>
                  {needsField('number') && (
                    <TextField
                      label="Número"
                      value={form.number}
                      onChange={e => set('number', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}
                  <TextField
                    label="Complemento (opcional)"
                    value={form.complemento}
                    onChange={e => set('complemento', e.target.value)}
                    sx={{ flex: 2 }}
                  />
                </Stack>
              )}
              {needsField('bairro') && (
                <TextField
                  label="Bairro"
                  fullWidth
                  value={form.bairro}
                  onChange={e => set('bairro', e.target.value)}
                />
              )}
              {(needsField('cidade') || needsField('uf')) && (
                <Stack direction="row" gap={2}>
                  {needsField('cidade') && (
                    <TextField
                      label="Cidade"
                      value={form.cidade}
                      onChange={e => set('cidade', e.target.value)}
                      sx={{ flex: 2 }}
                    />
                  )}
                  {needsField('uf') && (
                    <TextField
                      label="UF"
                      value={form.uf}
                      onChange={e =>
                        set('uf', e.target.value.toUpperCase().slice(0, 2))
                      }
                      sx={{ flex: 1 }}
                    />
                  )}
                </Stack>
              )}
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
                  ? 'Vinculamos você à empresa mantendo sua senha atual. Aguarde a aprovação — você receberá um e-mail assim que o admin analisar.'
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
            <Chip
              size="small"
              label="obrigatório"
              color="error"
              variant="outlined"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </Typography>
        {file ? (
          <Typography fontSize={12} color="text.secondary" noWrap>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.secondary">
            {doc.required ? 'Ainda não enviado' : 'Opcional'}
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
