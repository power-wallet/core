import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F59E0B', // Amber/Gold
      light: '#FBB042',
      dark: '#D97706',
    },
    secondary: {
      main: '#FB923C', // Orange
      light: '#FDBA74',
      dark: '#EA580C',
    },
    background: {
      default: '#0F0F0F', // Deep black
      paper: '#1A1A1A', // Dark gray
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#D1D5DB', // Light gray
    },
    divider: '#2D2D2D',
  },
  typography: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    h1: {
      fontWeight: 700,
      color: '#FFFFFF',
    },
    h2: {
      fontWeight: 700,
      color: '#FFFFFF',
    },
    h3: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h4: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h5: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h6: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
        contained: {
          boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1A1A',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          border: '1px solid #2D2D2D',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1A1A1A',
          borderBottom: '1px solid #2D2D2D',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1A1A1A',
          borderRight: '1px solid #2D2D2D',
        },
      },
    },
  },
});

export default theme;
