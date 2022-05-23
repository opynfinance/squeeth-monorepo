import { createStyles, makeStyles } from '@material-ui/core/styles'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useAtomValue } from 'jotai'

import { networkIdAtom } from 'src/state/wallet/atoms'
import { Networks } from '../types/index'
import CookieConsent from 'react-cookie-consent'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonWrapper: {
      display: 'flex',
      justifyContent: 'center',
      gap: 30,
      width: '100%',
      paddingBottom: '1.2rem',
      flexWrap: 'wrap',
    },

    link: {
      color: '#2ce6f9',
      textDecoration: 'underline',
    },
    container: {
      background: '#283944',
      color: '#ffffff',
      borderRadius: '8px',
      border: '2px solid #2ce6f9',
      boxShadow: '#393a3a 0px 5px 20px',
      width: '40%',
      right: '30px',
      bottom: '40px',
      overflow: 'hidden',
      [theme.breakpoints.down('sm')]: {
        width: '50%',
      },
      [theme.breakpoints.down('xs')]: {
        width: '100%',
        right: 0,
        bottom: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
      alignItems: 'baseline',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      position: 'fixed',
      zIndex: 999,
    },
    textContainer: {
      display: 'flex',
      alignItems: 'center',
      margin: '0 1em 2em 1em',
    },
    button: {
      fontSize: '13px',
      backgroundColor: '#2b8e99',
      color: '#ffffff',
      padding: '.75em 2em',
      borderRadius: 10,
      marginRight: '1em',
    },
    declineButton: {
      border: '1px solid #2b8e99',
      color: '#2ce6f9',
      borderRadius: 10,
      backgroundColor: '#283944',
      padding: '.75em 2em',
    },
    dialog: {
      background: '#283944',
      color: '#ffffff',
    },
    title: { margin: '.5em 0' },
  }),
)
const CookieConsentPopup = () => {
  const classes = useStyles()
  const router = useRouter()
  const [, setCookie] = useCookies(['opyn_geo'])
  const path = router.asPath.split('?')[0]
  const networkId = useAtomValue(networkIdAtom)

  return networkId !== Networks.ROPSTEN && path !== '/cookie-policy' ? (
    <CookieConsent
      location="none"
      buttonText="I Accept"
      cookieName="opyn_geo"
      containerClasses={classes.container}
      disableStyles={true}
      disableButtonStyles={true}
      buttonStyle={{
        backgroundColor: '#2b8e99',
        border: '1px solid #2b8e99',
        color: '#ffffff',
        padding: '.75em 2em',
        borderRadius: 10,
        cursor: 'pointer',
      }}
      setDeclineCookie={false}
      enableDeclineButton
      flipButtons
      declineButtonStyle={{
        border: '1px solid #2b8e99',
        color: '#2ce6f9',
        borderRadius: 10,
        backgroundColor: '#283944',
        padding: '.75em 2em',
        cursor: 'pointer',
      }}
      onAccept={() => {
        setTimeout(() => {
          router.push(path, undefined, { shallow: true })
        }, 0)
        setCookie(
          'opyn_geo',
          router.query?.restricted === 'true' ? `true,${router.query?.country}` : `false,${router.query?.country}`,
          {
            path: '/',
          },
        )
      }}
      contentStyle={{ flex: '1 0 0', padding: '1.2rem 1rem' }}
      buttonWrapperClasses={classes.buttonWrapper}
      expires={Infinity}
    >
      <h2 className={classes.title}>Your Cookie Settings</h2>
      We use cookies to recognize visitors and analyze front end traffic. To learn more about these methods, including
      how to disable them, view our{' '}
      <Link href="/cookie-policy">
        <a rel="noreferrer" target="_blank" className={classes.link}>
          Cookie Policy
        </a>
      </Link>
    </CookieConsent>
  ) : null
}

export default CookieConsentPopup
