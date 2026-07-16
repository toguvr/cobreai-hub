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

// ── Máscaras ─────────────────────────────────────────────────────
// Todas as máscaras trabalham com string livre — o form guarda o
// valor JÁ MASCARADO. Só na hora do submit chamamos onlyDigits.

const onlyDigits = (v: string): string => v.replace(/\D/g, '');

const maskCellphone = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCPF = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskCNS = (v: string): string => {
  const d = onlyDigits(v).slice(0, 15);
  // formato "### #### #### ####"
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 3));
  if (d.length > 3) parts.push(d.slice(3, 7));
  if (d.length > 7) parts.push(d.slice(7, 11));
  if (d.length > 11) parts.push(d.slice(11, 15));
  return parts.join(' ');
};

const maskCEP = (v: string): string => {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// DD/MM/AAAA — o usuário digita só dígitos, a máscara insere / na
// hora certa. Convertemos pra ISO (yyyy-mm-dd) no submit.
const maskBirthday = (v: string): string => {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** Retorna yyyy-mm-dd (formato do back) ou undefined se inválido. */
const birthdayToISO = (masked: string): string | undefined => {
  const m = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd);
  const mo = Number(mm);
  const y = Number(yyyy);
  // sanidade: 1900 < ano < ano atual, mês 1-12, dia 1-31
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const now = new Date();
  if (y < 1900 || y > now.getFullYear()) return undefined;
  return `${yyyy}-${mm}-${dd}`;
};

const isBirthdayValid = (masked: string): boolean =>
  !masked || !!birthdayToISO(masked);

// ── Validadores ────────────────────────────────────────────────
// CPF: algoritmo oficial da Receita — 11 dígitos + 2 dígitos
// verificadores. Rejeita sequências repetidas (000..., 111..., etc.).
const isValidCPF = (masked: string): boolean => {
  const d = onlyDigits(masked);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calcDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const digit1 = calcDigit(d.slice(0, 9), 10);
  if (digit1 !== parseInt(d[9], 10)) return false;
  const digit2 = calcDigit(d.slice(0, 10), 11);
  if (digit2 !== parseInt(d[10], 10)) return false;
  return true;
};

// RG não tem padrão nacional (cada estado emissor faz o seu). O
// máximo que dá pra fazer sem UF do documento é exigir uma
// quantidade mínima e máxima de caracteres alfanuméricos. Aceita
// letras (SP usa "X" como dígito verificador).
const isValidRG = (raw: string): boolean => {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '');
  return cleaned.length >= 5 && cleaned.length <= 14;
};

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
    already_approved: boolean;
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
        // Passa o e-mail digitado como context_email pra o back
        // ignorar "conflito" com a própria conta do médico. Sem isso,
        // completar sus/rg/celular na conta existente sempre volta
        // "já em uso" — porque o próprio user tem esses dados.
        const params: Record<string, string> = { field, value };
        if (field !== 'email' && form.email) {
          params.context_email = form.email.trim();
        }
        const res = await publicApi.get(
          `/public/enterprise/${enterprise_id}/registration/check`,
          { params },
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
    [enterprise_id, form.email],
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

  const needsField = (f: UserField): boolean => {
    // Se não veio de conta existente, sempre pede.
    if (!emailFoundExisting) return true;
    return emailMissingFields.includes(f);
  };

  // Se a conta já existe e todos os campos daquela etapa estão
  // preenchidos, a etapa fica "vazia" — não faz sentido mostrar um
  // Alert e obrigar clique pra avançar. Nesses casos pulamos.
  //
  // Etapa 0: sempre tem e-mail (nunca pula).
  // Etapa 3 (Anexos): sempre mostrada mesmo pra conta existente, pois
  // a empresa exige docs pra credenciar mesmo médicos já cadastrados.
  const stepIsEmpty = (s: number): boolean => {
    if (s === 1) {
      return (
        !needsField('cpf') &&
        !needsField('rg') &&
        !needsField('crm') &&
        !needsField('sus') &&
        !needsField('birthday')
      );
    }
    if (s === 2) {
      return (
        !needsField('cep') &&
        !needsField('street') &&
        !needsField('number') &&
        !needsField('bairro') &&
        !needsField('cidade') &&
        !needsField('uf')
      );
    }
    return false;
  };

  const goForward = () => {
    let next = step + 1;
    // Pula etapas vazias até chegar em 3 (Anexos) ou em 4 (Envio).
    while (next < 3 && stepIsEmpty(next)) next++;
    setStep(Math.min(3, next));
  };

  const goBack = () => {
    let prev = step - 1;
    while (prev > 0 && stepIsEmpty(prev)) prev--;
    setStep(Math.max(0, prev));
  };

  // Regras da etapa 0:
  // - E-mail sempre obrigatório e válido.
  // - Se a conta já existe (emailFoundExisting), nome e celular são
  //   opcionais aqui — o back reaproveita.
  // - Se é conta nova, exige nome e celular válidos.
  // - Nenhum campo unique pode estar 'taken' — mas 'taken' pra e-mail
  //   nunca acontece (reaproveitamos), só bloqueia se o campo estiver
  //   com problema real.
  const contactValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    fieldStatus.email !== 'checking' &&
    fieldStatus.email !== 'taken' &&
    (emailFoundExisting || form.name.trim().length > 2) &&
    (!needsField('cellphone') ||
      (onlyDigits(form.cellphone).length >= 10 &&
        fieldStatus.cellphone !== 'taken'));

  const docsValid = requiredDocs.every(d => files[d.id]);

  const hasTakenField = (fields: string[]) =>
    fields.some(f => fieldStatus[f] === 'taken');

  const canGoNext = () => {
    if (step === 0) return contactValid && !hasTakenField(['email', 'cellphone']);
    if (step === 1) {
      if (hasTakenField(['cpf', 'rg', 'crm', 'sus'])) return false;
      // Se digitou CPF, precisa ser válido (11 dígitos + checksum).
      const cpfDigits = onlyDigits(form.cpf);
      if (cpfDigits.length > 0 && !isValidCPF(form.cpf)) return false;
      // Se digitou RG, precisa ter tamanho mínimo.
      if (form.rg.length > 0 && !isValidRG(form.rg)) return false;
      // Nascimento com 10 chars precisa ser data válida.
      if (form.birthday.length === 10 && !isBirthdayValid(form.birthday))
        return false;
      return true;
    }
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
        cellphone: onlyDigits(form.cellphone),
        cpf: onlyDigits(form.cpf) || undefined,
        rg: form.rg || undefined,
        crm: form.crm || undefined,
        sus: onlyDigits(form.sus) || undefined,
        // birthday no form é DD/MM/AAAA; convertemos pra ISO
        // yyyy-mm-dd que é o que o back grava.
        birthday: birthdayToISO(form.birthday),
        cep: onlyDigits(form.cep) || undefined,
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
        already_approved: !!res.data?.already_approved,
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

              {/* E-mail vem primeiro pra o back detectar conta existente
                  e o formulário poder pular os campos que já estão
                  preenchidos (nome, celular, docs, endereço). */}
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                autoFocus
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

              {/* Nome só é pedido quando a conta é nova — se o e-mail já
                  existe, o back reaproveita o nome atual do user. */}
              {!emailFoundExisting && (
                <TextField
                  label="Nome completo"
                  fullWidth
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              )}

              {needsField('cellphone') && (
                <TextField
                  label="Celular (com DDD)"
                  fullWidth
                  value={form.cellphone}
                  onChange={e => {
                    const masked = maskCellphone(e.target.value);
                    set('cellphone', masked);
                    debouncedCheckField('cellphone', onlyDigits(masked));
                  }}
                  onBlur={() =>
                    checkField('cellphone', onlyDigits(form.cellphone))
                  }
                  placeholder="(31) 99999-9999"
                  inputProps={{ inputMode: 'numeric', maxLength: 15 }}
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

              {needsField('cpf') && (() => {
                // Só marca erro depois que o campo tem os 11 dígitos —
                // enquanto digita não mostra "inválido".
                const cpfDigits = onlyDigits(form.cpf);
                const cpfBadChecksum =
                  cpfDigits.length === 11 && !isValidCPF(form.cpf);
                const takenErr = errorFor('cpf');
                return (
                  <TextField
                    label="CPF"
                    fullWidth
                    value={form.cpf}
                    onChange={e => {
                      const masked = maskCPF(e.target.value);
                      set('cpf', masked);
                      debouncedCheckField('cpf', onlyDigits(masked));
                    }}
                    onBlur={() => checkField('cpf', onlyDigits(form.cpf))}
                    placeholder="000.000.000-00"
                    inputProps={{ inputMode: 'numeric', maxLength: 14 }}
                    error={takenErr || cpfBadChecksum}
                    helperText={
                      cpfBadChecksum
                        ? 'CPF inválido — confira os dígitos.'
                        : helperFor('cpf')
                    }
                  />
                );
              })()}
              {needsField('rg') && (() => {
                const rgBadFormat = form.rg.length > 0 && !isValidRG(form.rg);
                const takenErr = errorFor('rg');
                return (
                  <TextField
                    label="RG"
                    fullWidth
                    value={form.rg}
                    onChange={e => {
                      set('rg', e.target.value);
                      debouncedCheckField('rg', e.target.value);
                    }}
                    onBlur={() => checkField('rg', form.rg)}
                    inputProps={{ maxLength: 20 }}
                    error={takenErr || rgBadFormat}
                    helperText={
                      rgBadFormat
                        ? 'RG deve ter entre 5 e 14 caracteres.'
                        : helperFor('rg')
                    }
                  />
                );
              })()}
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
                    const masked = maskCNS(e.target.value);
                    set('sus', masked);
                    debouncedCheckField('sus', onlyDigits(masked));
                  }}
                  onBlur={() => checkField('sus', onlyDigits(form.sus))}
                  placeholder="000 0000 0000 0000"
                  inputProps={{ inputMode: 'numeric', maxLength: 18 }}
                  error={errorFor('sus')}
                  helperText={helperFor('sus')}
                />
              )}
              {needsField('birthday') && (
                <TextField
                  label="Data de nascimento"
                  fullWidth
                  value={form.birthday}
                  onChange={e => set('birthday', maskBirthday(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                  error={
                    form.birthday.length === 10 && !isBirthdayValid(form.birthday)
                  }
                  helperText={
                    form.birthday.length === 10 && !isBirthdayValid(form.birthday)
                      ? 'Data inválida'
                      : undefined
                  }
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
                    const masked = maskCEP(e.target.value);
                    set('cep', masked);
                    debouncedCep(masked);
                  }}
                  onBlur={() => lookupCep(form.cep)}
                  placeholder="00000-000"
                  inputProps={{ inputMode: 'numeric', maxLength: 9 }}
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
                {submitted.already_approved
                  ? 'Documentos enviados!'
                  : 'Cadastro enviado!'}
              </Typography>
              <Typography textAlign="center" color="text.secondary">
                {submitted.already_approved
                  ? 'Seu cadastro na empresa continua aprovado — os novos documentos foram anexados ao seu perfil.'
                  : submitted.already_had_account
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
                onClick={goBack}
              >
                Voltar
              </Button>
              {step < 3 ? (
                <Button
                  variant="contained"
                  disabled={!canGoNext() || submitting}
                  onClick={goForward}
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
