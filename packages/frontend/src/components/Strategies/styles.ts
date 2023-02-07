import { makeStyles, createStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    heading: {
      fontSize: '32px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: '130%',
    },
    description: {
      fontSize: '18px',
      color: 'rgba(255, 255, 255, 0.6)',
      fontWeight: 400,
      lineHeight: '130%',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: '130%',
    },
    text: {
      fontSize: '18px',
      color: '#BDBDBD',
      lineHeight: '130%',
    },
    textSmall: {
      fontSize: '14px',
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: 500,
    },
    textMargin: {
      marginTop: '8px',
    },
    textSemibold: {
      fontWeight: 500,
    },
    colorSuccess: {
      color: theme.palette.success.main,
    },
    colorError: {
      color: theme.palette.error.main,
    },
    infoIcon: {
      color: theme.palette.text.hint,
    },
    loadingSpinner: {
      color: '#BDBDBD',
      lineHeight: '130%',
    },
    textMonospace: {
      fontFamily: 'DM Mono',
    },
    divider: {
      width: '15px',
      backgroundColor: '#8C8D8D',
      height: '1.5px',
      position: 'relative',
      top: '6px',
    },
    shimmer: { display: 'flex', flexDirection: 'column', gap: '8px', height: '500px' },
  }),
)

export default useStyles
