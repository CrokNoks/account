import { defaultTheme } from 'react-admin';
import { createTheme } from '@mui/material/styles';

// Définition des overrides communs (mobile, etc.)
const componentOverrides = {
  MuiButton: {
    styleOverrides: {
      root: {
        // Boutons plus faciles à toucher sur mobile
        '@media (max-width:600px)': {
          padding: '8px 16px',
          minHeight: '48px',
        },
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        // Réduire le padding des tableaux sur mobile pour afficher plus de données
        '@media (max-width:600px)': {
          padding: '8px 4px',
          fontSize: '0.875rem',
        },
      },
    },
  },
  MuiToolbar: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          minHeight: '56px',
          paddingLeft: '8px',
          paddingRight: '8px',
        },
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        // Drawer prend plus de place sur mobile pour le contenu
        '@media (max-width:600px)': {
          width: '100% !important', // Force full width
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        '@media (max-width:600px)': {
          margin: '16px',
          width: 'calc(100% - 32px)',
        },
      },
    },
  },
  RaToolbar: {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
      },
    },
  },
  MuiFormControl: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          marginBottom: '2px',
          marginTop: '2px',
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      input: {
        '@media (max-width:600px)': {
          padding: '5px 7px',
        },
      },
    },
  },
  RaSimpleForm: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          padding: '2px',
        },
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        '@media (max-width:600px)': {
          padding: '8px',
          '&:last-child': {
            paddingBottom: '8px',
          },
        },
      },
    },
  },
};

const typographyOverrides = {
  ...defaultTheme.typography,
  h6: {
    '@media (max-width:600px)': {
      fontSize: '1.1rem',
    },
  },
};

export const lightTheme = createTheme({
  ...defaultTheme,
  palette: {
    ...defaultTheme.palette,
    mode: 'light',
  },
  components: {
    ...defaultTheme.components,
    ...componentOverrides,
  },
  typography: typographyOverrides,
});

export const darkTheme = createTheme({
  ...defaultTheme,
  palette: {
    ...defaultTheme.palette,
    mode: 'dark', // Active le mode sombre
    primary: {
      main: '#90caf9', // Bleu plus clair pour le dark mode (standard MUI)
    },
    secondary: {
      main: '#f48fb1', // Rose plus clair pour le dark mode
    },
    background: {
      default: '#121212', // Fond sombre standard
      paper: '#1e1e1e',
    }
  },
  components: {
    ...defaultTheme.components,
    ...componentOverrides,
  },
  typography: typographyOverrides,
});
