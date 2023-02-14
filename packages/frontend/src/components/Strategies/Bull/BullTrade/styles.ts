import { makeStyles, createStyles } from '@material-ui/core'

export const useZenBullStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      marginTop: theme.spacing(3),
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
    infoIconGray: {
      marginRight: theme.spacing(2),
      color: theme.palette.text.hint,
    },
    subtitle: {
      fontSize: '18px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: '130%',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    btnDefault: {
      color: 'rgba(255, 255, 255, 0.4)',
      border: '2px solid transparent',
    },
    btnActive: {
      color: theme.palette.primary.main,
      border: `2px solid ${theme.palette.primary.main}`,
    },
  }),
)
