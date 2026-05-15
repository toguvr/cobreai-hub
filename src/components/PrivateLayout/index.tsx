import { useState } from 'react';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Sidebar } from '../Sidebar';
import { useBrand } from '../../hooks/useBrand';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function PrivateLayout({ children }: Props) {
  const brand = useBrand();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Sidebar
        mobileOpen={isMobile && mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isMobile={isMobile}
      />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {isMobile && (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: brand.primaryDark,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Toolbar variant="dense" sx={{ minHeight: 52 }}>
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setMobileOpen(true)}
                aria-label="abrir menu"
              >
                <MenuIcon />
              </IconButton>
              <Typography fontSize={14} fontWeight={700} ml={1} noWrap>
                {brand.title}
              </Typography>
            </Toolbar>
          </AppBar>
        )}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}
