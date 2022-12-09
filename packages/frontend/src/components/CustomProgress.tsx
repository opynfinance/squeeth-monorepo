import LinearProgress from '@material-ui/core/LinearProgress'
import { withStyles, createStyles } from '@material-ui/core/styles'

const CustomLinearProgress = withStyles((theme) =>
  createStyles({
    root: {
      height: 10,
      borderRadius: 5,
    },
    colorPrimary: {
      backgroundColor: `${theme.palette.primary.main}10`,
    },
    bar: {
      borderRadius: 5,
      backgroundColor: `${theme.palette.primary.main}`,
    },
  }),
)(LinearProgress)

export const CustomLinearProgressNew = withStyles((theme) =>
  createStyles({
    root: {
      height: 10,
      borderRadius: 5,
    },
    colorPrimary: {
      backgroundColor: `${theme.palette.success.main}10`,
    },
    bar: {
      borderRadius: 5,
      backgroundColor: `${theme.palette.success.main}`,
    },
  }),
)(LinearProgress)

export default CustomLinearProgress
