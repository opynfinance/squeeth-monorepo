import { makeStyles, createStyles } from '@material-ui/core'

export const useZenBullStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
    },
    notice: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2),
      border: `1px solid #F3FF6C`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: 'rgba(243, 255, 108, 0.1)',
      alignItems: 'center',
    },
    infoIcon: {
      marginRight: theme.spacing(2),
      color: '#F3FF6C',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    slippageContainer: {
      [theme.breakpoints.down('xs')]: {
        flexWrap: 'wrap',
      },
    },
  }),
)
