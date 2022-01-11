import { createTheme, ThemeOptions } from '@material-ui/core/styles'

export enum Mode {
  LIGHT = 'light',
  DARK = 'DARK',
}

const getTheme = (mode: Mode) => {
  const palette = mode === 'light' ? lightPalette : darkPalete

  return createTheme({
    ...palette,
    typography: {
      fontWeightBold: 500,
      fontFamily: [
        'Open Sans',
        'Mulish',
        'Inter',
        'Roboto Mono',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        '"Segoe UI Emoji"',
      ].join(','),
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
      },
    },
    props: {
      MuiButtonBase: {
        disableRipple: true,
      },
      MuiButtonGroup: {
        disableRipple: true,
      },
    },
    overrides: {
      MuiTableCell: {
        root: {
          fontSize: '.7rem',
          padding: '8px',
          border: 'none',
        },
      },
      MuiCard: {
        root: {
          boxShadow: 'none',
          borderRadius: '10px',
        },
      },
      MuiButton: {
        root: {
          borderRadius: '10px',
          color: '#000',
        },
        text: {
          color: '#000',
        },
      },
      MuiTooltip: {
        tooltip: {
          backgroundColor: '#383838',
          opacity: '1',
        },
      },
    },
  })
}

const lightPalette: ThemeOptions = {
  palette: {
    type: 'light',
    primary: {
      main: '#4DADF3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00fff9',
    },
    error: {
      light: '#F2F2F2',
      main: '#EC7987',
      dark: '#BDBDBD',
    },
    warning: {
      light: '#F5B07326',
      main: '#F5B073',
    },
    success: {
      main: '#49D273',
      light: '#B2F0C5',
    },
    text: {
      primary: '#545454',
    },
    background: {
      default: '#F8F8F9',
      stone: '#DCDAE9',
      lightStone: '#DCDAE94D',
      tooltip: '#77757E80',
    },
  },
}

const darkPalete: ThemeOptions = {
  palette: {
    type: 'dark',
    primary: {
      main: '#2CE6F9',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00fff9',
    },
    error: {
      main: '#f5475c',
    },
    warning: {
      light: '#F5B07326',
      main: '#F5B073',
    },
    success: {
      main: '#49D273',
      light: '#B2F0C5',
    },
    background: {
      stone: 'rgba(255, 255, 255, 0.12)',
      lightStone: 'rgba(255, 255, 255, 0.08)',
      tooltip: 'rgba(255, 255, 255)',
      default: '#181B1C',
    },
  },
}

export default getTheme
