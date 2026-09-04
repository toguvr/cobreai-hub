import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  Divider,
  Autocomplete,
  InputAdornment,
  TextField,
  createFilterOptions,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DescriptionIcon from '@mui/icons-material/Description';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';

const DRAWER_WIDTH = 240;

/** Ignora acento e caixa: "sao" acha "São". */
const normalize = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

interface EnterpriseOption {
  id: string;
  title: string;
}

const filterEnterprises = createFilterOptions<EnterpriseOption>({
  stringify: option => normalize(option.title),
});

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Hospitais', icon: <LocalHospitalIcon />, path: '/hospitais' },
  { label: 'Membros', icon: <PeopleIcon />, path: '/usuarios' },
  { label: 'Credenciamento', icon: <HowToRegIcon />, path: '/credenciamento' },
  { label: 'Vínculos', icon: <AccountTreeIcon />, path: '/vinculos' },
  { label: 'Documentos', icon: <DescriptionIcon />, path: '/documentos' },
  { label: 'Benefícios', icon: <CardGiftcardIcon />, path: '/beneficios' },
  { label: 'Financeiro', icon: <AttachMoneyIcon />, path: '/financeiro' },
  { label: 'Preços & Fechamento', icon: <PriceChangeIcon />, path: '/precos' },
  // Ocultos do menu a pedido — as rotas seguem ativas em /monitoramento e
  // /comunicacoes para quem acessar pela URL direta.
  // { label: 'Monitoramento', path: '/monitoramento' }  (icone: MonitorHeart)
  // { label: 'Comunicações',  path: '/comunicacoes' }   (icone: Campaign)
  { label: 'Configurações', icon: <SettingsIcon />, path: '/configuracoes' },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  isMobile = false,
}: SidebarProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { enterprises, current, setCurrent } = useEnterprise();
  const enterpriseOptions: EnterpriseOption[] = enterprises.map(ue => ({
    id: ue.enterprise.id,
    title: ue.enterprise.title,
  }));
  // disableClearable exige valor sempre presente. O bloco só renderiza
  // com 2+ organizações, então o fallback existe de fato.
  const selectedEnterprise =
    enterpriseOptions.find(option => option.id === current?.id) ??
    enterpriseOptions[0];
  const brand = useBrand();

  // Cores derivadas para texto/decoração sobre o fundo escuro
  const onDarkPrimary = '#fff';
  const onDarkMuted = 'rgba(255,255,255,0.65)';
  const onDarkFaint = 'rgba(255,255,255,0.45)';
  const onDarkBorder = 'rgba(255,255,255,0.14)';

  // No mobile, a sidebar vira temporary (gaveta); no desktop, permanent.
  const drawerVariant = isMobile ? 'temporary' : 'permanent';

  return (
    <Drawer
      variant={drawerVariant}
      open={isMobile ? mobileOpen : true}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: isMobile ? 0 : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: brand.primaryDark,
          color: onDarkPrimary,
          borderRight: 'none',
        },
      }}
    >
      {/* Logo / Header */}
      <Box sx={{ p: 2.25, pb: 1.5 }}>
        {brand.logo ? (
          <Box display="flex" alignItems="center" gap={1.25}>
            <Box
              sx={{
                width: 38, height: 38, borderRadius: 1.5,
                bgcolor: '#fff', p: 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            >
              <img
                src={brand.logo}
                alt={brand.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            <Box minWidth={0}>
              <Typography
                fontSize={14} fontWeight={700} color={onDarkPrimary}
                noWrap title={brand.title}
              >
                {brand.title}
              </Typography>
              <Typography fontSize={10} color={onDarkFaint} letterSpacing={0.5} textTransform="uppercase">
                Hub
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            <Typography variant="h6" fontWeight={700} color={onDarkPrimary} letterSpacing={-0.5}>
              {brand.title}
            </Typography>
            <Typography variant="caption" color={onDarkFaint} textTransform="uppercase" letterSpacing={0.6}>
              Hub
            </Typography>
          </>
        )}
      </Box>

      {/* Seletor de organização */}
      {enterprises.length > 1 && (
        <Box sx={{ px: 2, pb: 1, mt: 0.5 }}>
          <Autocomplete
            options={enterpriseOptions}
            value={selectedEnterprise}
            size="small"
            fullWidth
            // Sempre precisa de uma organização ativa — sem limpar.
            disableClearable
            openOnFocus
            // Clicar já seleciona o texto: digitar troca a busca direto.
            selectOnFocus
            handleHomeEndKeys
            blurOnSelect
            // Enter confirma o primeiro resultado, sem mouse.
            autoHighlight
            filterOptions={filterEnterprises}
            getOptionLabel={option => option.title ?? ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, option) => {
              const found = enterprises.find(
                ue => ue.enterprise.id === option?.id,
              );
              if (found) setCurrent(found.enterprise);
            }}
            noOptionsText="Nenhuma organização"
            renderInput={params => (
              <TextField
                {...params}
                placeholder="Buscar organização"
                inputProps={{
                  ...params.inputProps,
                  'aria-label': 'Organização',
                }}
                InputProps={{
                  ...params.InputProps,
                  // Sinaliza que dá pra digitar — sem a lupa o campo
                  // parece um select comum e ninguém tenta buscar.
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0 }}>
                      <SearchIcon sx={{ fontSize: 15, color: onDarkFaint }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                fontSize: 12,
                color: onDarkPrimary,
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: onDarkBorder,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255,255,255,0.3)',
              },
              '& .MuiSvgIcon-root': { color: onDarkPrimary },
              '& .MuiInputBase-input::placeholder': {
                color: onDarkFaint,
                opacity: 1,
              },
            }}
            slotProps={{
              paper: {
                sx: {
                  '& .MuiAutocomplete-listbox': { maxHeight: 260, fontSize: 13 },
                },
              },
            }}
          />
        </Box>
      )}

      <Divider sx={{ borderColor: onDarkBorder, mx: 2, mt: 1 }} />

      {/* Nav */}
      <List sx={{ px: 1, pt: 1.25, flex: 1 }}>
        {navItems.map(item => {
          const active = location.pathname === item.path
            || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile && onMobileClose) onMobileClose();
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                py: 0.85,
                bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                position: 'relative',
                '&::before': active ? {
                  content: '""',
                  position: 'absolute',
                  left: -8,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  bgcolor: brand.primary,
                  borderRadius: 4,
                } : {},
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: active ? onDarkPrimary : onDarkMuted }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? onDarkPrimary : onDarkMuted,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: onDarkBorder, mx: 2 }} />

      {/* User footer */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar
          src={user?.avatar_url}
          sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 600 }}
        >
          {user?.name?.[0]}
        </Avatar>
        <Box flex={1} overflow="hidden">
          <Typography fontSize={12} fontWeight={600} color={onDarkPrimary} noWrap>
            {user?.name}
          </Typography>
          <Typography fontSize={10} color={onDarkFaint} noWrap>
            {user?.email}
          </Typography>
        </Box>
        <LogoutIcon
          sx={{
            fontSize: 18, color: onDarkFaint, cursor: 'pointer',
            transition: 'color 0.12s',
            '&:hover': { color: onDarkPrimary },
          }}
          onClick={signOut}
        />
      </Box>
    </Drawer>
  );
}
