import Button from '@material-ui/core/Button'
import { withStyles } from '@material-ui/core/styles'

export const PrimaryButton = withStyles((theme) => ({
  root: {
    color: '#000',
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
    minHeight: '2rem',
    minWidth: '300px',
  },
}))(Button)

export const ErrorButton = withStyles((theme) => ({
  root: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.error.main,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
    minHeight: '2rem',
    minWidth: '300px',
  },
}))(Button)

export const LinkButton = withStyles((theme) => ({
  root: {
    color: theme.palette.primary.main,
    background: 'transparent',
    '&:hover': {
      background: 'transparent',
    },
    padding: '0',
  },
}))(Button)

export const AddButton = withStyles((theme) => ({
  root: {
    color: '#000',
    backgroundColor: theme.palette.success.main,
    '&:hover': {
      backgroundColor: theme.palette.success.dark,
    },
    '&:disabled': {
      backgroundColor: theme.palette.background.lightStone,
    },
  },
}))(Button)

export const RemoveButton = withStyles((theme) => ({
  root: {
    color: '#000',
    backgroundColor: theme.palette.error.main,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
    '&:disabled': {
      backgroundColor: theme.palette.background.lightStone,
    },
  },
}))(Button)

export const GreyButton = withStyles((theme) => ({
  root: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
}))(Button)

export const PrimaryButtonNew = withStyles((theme) => ({
  root: {
    color: theme.palette.background.default,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
    '&:disabled': {
      color: 'rgba(255, 255, 255, 0.4)',
      backgroundColor: theme.palette.background.lightStone,
    },
    minHeight: '2rem',
    minWidth: '300px',
    padding: '8px',
    fontSize: '18px',
    fontWeight: 700,
    textTransform: 'initial',
  },
}))(Button)

export const RoundedButton = withStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.background.stone,
    '&:disabled': {
      color: 'rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(36, 39, 40, 0.6)',
      opacity: 1,
    },
    textTransform: 'initial',
    borderRadius: '20px',
    padding: '4px 24px',
    fontSize: '16px',
    fontWeight: 700,
  },
}))(Button)
