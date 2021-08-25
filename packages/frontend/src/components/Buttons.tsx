import Button from '@material-ui/core/Button'
import { withStyles } from '@material-ui/core/styles'

export const PrimaryButton = withStyles((theme) => ({
  root: {
    color: '#000',
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}))(Button)

export const ErrorButton = withStyles((theme) => ({
  root: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.error.main,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
  },
}))(Button)
