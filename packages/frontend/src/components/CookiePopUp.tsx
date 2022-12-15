import CookieConsent, { Cookies } from "react-cookie-consent";
import { CookieNames, trackCookieChoice } from "@utils/cookies";
import { createStyles, makeStyles } from "@material-ui/core";
import Link from "next/link";



const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      maxWidth: '450px',
      backgroundClip: theme.palette.primary.main,
      position: 'fixed',
      top: '60%',
      right: '0px',
      bottom: 'auto',
      zIndex: 2000,
      transform: 'translate3d(-10%, -50%, 9999990px)',
      width: '85%',
    },
  }),
)

const CookiePopUp: React.FC = () => {
  const styles = useStyles()

  return (
    <div className={styles.container}>
      <CookieConsent
        location="none"
        buttonText="Accept"
        onAccept={() => {
          trackCookieChoice(true)
        }}
        cookieName={CookieNames.Consent}
        style={{ background: '#3F4243', borderRadius: '10px', textAlign: 'left' }}
        buttonStyle={{
          backgroundColor: '#D9D9D9',
          borderRadius: '10px',
          padding: '12px 24px',
          color: '#525556',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
        expires={365}
        enableDeclineButton
        declineButtonText= "Decline"
        declineButtonStyle={{
          backgroundColor: 'transparent',
          border: '2px solid #D9D9D9',
          padding: '10px 20px',
          borderRadius: '10px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
        onDecline={() => {
          trackCookieChoice(false)
        }}
        flipButtons
        overlay
      >
        <h3>Cookie Preferences</h3>
        We use cookies to support technical features that enhance your user experience and analyze frontend traffic. To
        learn more about these methods, including how to disable them, view our{' '}
        <span style={{ color: '#2CE6F9' }}>
          {' '}
          <Link href="/privacy-policy">
            <a target="_blank">Privacy Policy.</a>
          </Link>{' '}
        </span>
      </CookieConsent>
    </div>
  )
}

export default CookiePopUp
