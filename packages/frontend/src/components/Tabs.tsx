import { Tab, Tabs } from '@material-ui/core'
import { withStyles } from '@material-ui/core/styles'

export const SqueethTabs = withStyles((theme) => {
  return {
    root: {
      borderRadius: theme.spacing(1),
      background: theme.palette.background.lightStone,
      padding: theme.spacing(0.75),
    },
    indicator: {
      height: '100%',
      borderRadius: theme.spacing(0.7),
      background: theme.palette.primary.main,
      opacity: '.1',
    },
  }
})(Tabs)

export const SqueethTab = withStyles((theme) => {
  return {
    root: {
      textTransform: 'initial',
      minWidth: theme.spacing(10),
      minHeight: 'auto',
      '&$selected': {
        color: theme.palette.primary.main,
        fontWeight: theme.typography.fontWeightMedium,
      },
    },
    selected: {
      color: theme.palette.primary.main,
    },
  }
})(Tab)

export const SecondaryTabs = withStyles((theme) => {
  return {
    root: {
      background: 'transparent',
      padding: theme.spacing(0),
      borderRadius: theme.spacing(2, 2, 0, 0),
    },
    indicator: {
      height: '0px',
      width: '100%',
      padding: theme.spacing(0),
      background: 'transparent',
    },
  }
})(Tabs)

export const SecondaryTab = withStyles((theme) => {
  return {
    root: {
      textTransform: 'initial',
      color: theme.palette.text.secondary,
      backgroundColor: theme.palette.background.lightStone,
      '&$selected': {
        color: theme.palette.text.primary,
        fontWeight: theme.typography.fontWeightMedium,
        backgroundColor: 'transparent',
      },
    },
    selected: {
      color: theme.palette.primary.main,
    },
  }
})(Tab)
