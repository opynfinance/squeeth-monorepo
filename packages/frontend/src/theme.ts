import { createTheme, ThemeOptions } from '@material-ui/core/styles'

export enum Mode {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  NEW_DARK = 'NEW_DARK',
}

const getTheme = (mode: Mode) => {
  const palette = mode === Mode.LIGHT ? lightPalette : mode === Mode.NEW_DARK ? newDarkPalette : darkPalette

  return createTheme({
    ...palette,
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
          textTransform: 'initial',
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

const getTypography = (mode: Mode) => {
  if (mode === Mode.NEW_DARK) {
    return {
      fontWeightBold: 500,
      fontFamily: [
        'DM Sans',
        'Open Sans',
        'Mulish',
        'Inter',
        'DM Mono',
        'Roboto Mono',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        '"Segoe UI Emoji"',
      ].join(','),
    }
  } else {
    return {
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
    }
  }
}

const lightPalette: ThemeOptions = {
  typography: getTypography(Mode.LIGHT),
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

const darkPalette: ThemeOptions = {
  typography: getTypography(Mode.DARK),
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

const newDarkPalette: ThemeOptions = {
  typography: getTypography(Mode.NEW_DARK),
  palette: {
    type: 'dark',
    primary: {
      main: '#70E3F6',
      light: '#18F5D7',
      dark: '#0ebcd8', // todo: not sure what this should be since its not specified in figma
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00fff9',
    },
    error: {
      main: '#f5475c',
      light: '#f5475c1a',
    },
    warning: {
      main: '#F3FF6C',
      light: '#F3FF6C1A',
    },
    success: {
      main: '#67fabf',
      light: '#67fabf1A',
    },
    background: {
      stone: '#242728',
      lightStone: '#303436',
      tooltip: 'rgba(255, 255, 255)',
      default: '#191B1C',
    },
  },
}

export default getTheme
