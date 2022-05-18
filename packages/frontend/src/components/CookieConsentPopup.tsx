import { createStyles, makeStyles } from '@material-ui/core/styles'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useAtomValue } from 'jotai'

import { networkIdAtom } from 'src/state/wallet/atoms'
import { Networks } from '../types/index'
import CookieConsent from 'react-cookie-consent'

const useStyles = makeStyles(() =>
  createStyles({
    buttonWrapper: {
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      paddingBottom: '1em',
      flexWrap: 'wrap',
    },

    link: {
      color: '#2ce6f9',
      textDecoration: 'underline',
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
  const path = router.pathname
  const networkId = useAtomValue(networkIdAtom)

  return networkId !== Networks.ROPSTEN && path !== '/cookie-policy' ? (
    <CookieConsent
      location="bottom"
      buttonText="I Accept"
      cookieName="opyn_geo"
      style={{
        background: '#283944',
        color: '#ffffff',
        borderRadius: '5px',
        boxShadow: '5px 3px 32px -6px rgb(14 103 112 / 56%)',
        width: '50%',
      }}
      buttonStyle={{
        backgroundColor: '#2b8e99',
        color: '#ffffff',
        padding: '.75em 2em',
        borderRadius: 10,
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
      }}
      onAccept={() => {
        router.push(path, undefined, { shallow: true })
        setCookie('opyn_geo', router.query?.restricted === 'true' ? `true,${router.query?.country}` : 'false')
      }}
      contentStyle={{ flex: '1 0 0' }}
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
