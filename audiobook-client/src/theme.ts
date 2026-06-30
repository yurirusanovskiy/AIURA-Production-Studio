'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#82B1FF', // Light blue from Figma buttons
      light: '#AECBFF',
      dark: '#5B8CFF',
    },
    secondary: {
      main: '#FF8A80',
      light: '#FFBCB5',
      dark: '#FF5252',
    },
    background: {
      default: '#151A25', // Main app background
      paper: '#212836', // Card background
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), Roboto, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none', // Remove default elevation overlay
          border: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#10141D', // Sidebar background
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
  },
});

export default theme;
