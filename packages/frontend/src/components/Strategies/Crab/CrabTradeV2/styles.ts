import { makeStyles, createStyles } from '@material-ui/core/styles'

export const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      color: theme.palette.primary.main,
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      marginTop: '12px',
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
    noticeGray: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2.5),
      border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: theme.palette.background.lightStone,
      alignItems: 'center',
    },
    infoIconGray: {
      marginRight: theme.spacing(2),
      color: theme.palette.text.hint,
    },
    tokenSelectBox: {
      display: 'flex',
      alignItems: 'center',
    },
    tokenChoice: {
      fontWeight: 500,
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
    ctaSection: {
      marginTop: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    queueNotice: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1.5),
      padding: theme.spacing(2),
      textAlign: 'center',
    },
    btnDefault: {
      color: 'rgba(255, 255, 255, 0.4)',
      border: '2px solid transparent',
    },
    btnActive: {
      color: theme.palette.primary.main,
      border: `2px solid ${theme.palette.primary.main}`,
    },
    btnDanger: {
      color: theme.palette.error.main,
      borderColor: theme.palette.error.main,
      backgroundColor: 'transparent',

      '&:hover': {
        color: theme.palette.error.main,
        borderColor: theme.palette.error.main,
        backgroundColor: 'transparent',
      },
    },
    btnWarning: {
      color: theme.palette.warning.main,
      borderColor: theme.palette.warning.main,
      backgroundColor: 'transparent',

      '&:hover': {
        color: theme.palette.warning.main,
        borderColor: theme.palette.warning.main,
        backgroundColor: 'transparent',
      },
    },
  }),
)
