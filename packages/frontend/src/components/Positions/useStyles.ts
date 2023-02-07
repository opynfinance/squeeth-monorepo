import { createStyles, makeStyles } from '@material-ui/core'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(6, 8),
      width: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingBottom: theme.spacing(8),
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        padding: theme.spacing(0, 2),
      },
    },
    sectionHeaderFirst: {
      marginTop: theme.spacing(5),
      display: 'flex',
      justifyContent: 'space-between',
    },
    sectionHeader: {
      marginTop: theme.spacing(8),
      display: 'flex',
      justifyContent: 'space-between',
    },
    sectionContent: {
      marginTop: theme.spacing(1.5),
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: '130%',
    },
    textMonospace: {
      fontFamily: 'DM Mono',
    },
    position: {
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.stone,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    },
    positionData: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    shortPositionData: {
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    innerPositionData: {
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
    },
    positionColumn: {
      flex: 1,
    },
    rowMarginTop: {
      marginTop: '16px',
    },
    positionTitle: {
      width: '30%',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: 14,
      marginTop: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '12px',
      marginLeft: theme.spacing(0.5),
    },
    tooltipContainer: {
      marginLeft: '.5em',
      display: 'flex',
      alignItems: 'center',
    },
    titleWithTooltip: {
      display: 'flex',
      alignItems: 'center',
    },
    pnlTitle: {
      display: 'flex',
      alignItems: 'center',
    },
    emoji: {
      width: '18px',
      maxHeight: '25px',
    },
  }),
)

export default useStyles
