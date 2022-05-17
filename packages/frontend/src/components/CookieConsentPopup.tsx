import CookieConsent from 'react-cookie-consent'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonWrapper: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
    },

    link: {
      color: '#2ce6f9',
      textDecoration: 'underline',
    },
  }),
)
const CookieConsentPopup = () => {
  const classes = useStyles()
  const router = useRouter()
  const [cookies, setCookie] = useCookies(['restricted'])

  console.log(router.query, 'hello')
  return (
    <CookieConsent
      cookieName="restricted"
      style={{
        background: '#424242',
        color: '#ffffff',
        borderRadius: '5px',
        marginTop: '-100px',
        marginLeft: '-250px',
        boxShadow: '10px -15px 12px -4px rgba(0,0,0,0.3)',
        height: '35vh',
        width: '30vw',
        top: '50%',
        left: '50%',
      }}
      buttonStyle={{
        fontSize: '13px',
        backgroundColor: '#2b8e99',
        color: '#ffffff',
        padding: '.75em 3em',
        borderRadius: 10,
      }}
      declineButtonStyle={{
        border: '1px solid #2b8e99',
        color: '#2ce6f9',
        borderRadius: 10,
        backgroundColor: '#424242',
        padding: '.75em 3em',
      }}
      onAccept={() =>
        setCookie('restricted', router.query.restricted === 'true' ? `true,${router.query.country}` : 'false')
      }
      expires={150}
      enableDeclineButton
      flipButtons
      buttonText="I Accept"
      declineButtonText="Decline"
      buttonWrapperClasses={classes.buttonWrapper}
    >
      We use cookies to recognize visitors and analyze front end traffic. To learn more about these methods, including
      how to disable them, view our{' '}
      <Link href="/">
        <a className={classes.link}>Cookie Policy</a>
      </Link>
      .
    </CookieConsent>
  )
}

export default CookieConsentPopup
