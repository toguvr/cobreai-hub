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
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEnterprise } from '../../contexts/EnterpriseContext';
import { useBrand } from '../../hooks/useBrand';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Hospitais', icon: <LocalHospitalIcon />, path: '/hospitais' },
  { label: 'Membros', icon: <PeopleIcon />, path: '/usuarios' },
  { label: 'Financeiro', icon: <AttachMoneyIcon />, path: '/financeiro' },
  { label: 'Preços & Fechamento', icon: <PriceChangeIcon />, path: '/precos' },
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
          <FormControl fullWidth size="small">
            <Select
              value={current?.id || ''}
              onChange={e => {
                const found = enterprises.find(
                  ue => ue.enterprise.id === e.target.value,
                );
                if (found) setCurrent(found.enterprise);
              }}
              sx={{
                color: onDarkPrimary,
                '.MuiOutlinedInput-notchedOutline': { borderColor: onDarkBorder },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '.MuiSvgIcon-root': { color: onDarkPrimary },
                fontSize: 12,
                bgcolor: 'rgba(255,255,255,0.05)',
              }}
            >
              {enterprises.map(ue => (
                <MenuItem key={ue.enterprise.id} value={ue.enterprise.id}>
                  {ue.enterprise.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
