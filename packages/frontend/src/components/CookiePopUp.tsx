import CookieConsent, { Cookies } from "react-cookie-consent";
import { CookieNames } from "@utils/cookies";
import { createStyles, makeStyles } from "@material-ui/core";

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
      transform: 'translate3d(-10%, -50%, 9999990px)',
      width: '85%',
    },
  }),
)


const CookiePopUp : React.FC = () => {
    const styles = useStyles()

  return (
    <div className={styles.container}>
      <CookieConsent
        location="none"
        buttonText="Accept"
        cookieName={CookieNames.Consent}
        style={{  background: "#3F4243", borderRadius: "10px", textAlign:'left' }}
        buttonStyle={{ backgroundColor:"#D9D9D9", borderRadius:"10px", padding:'12px 24px', color: "#525556", fontSize: "14px", fontWeight:'bold' }}
        expires={365}
        enableDeclineButton
        declineButtonText= "Decline"
        declineButtonStyle={{ backgroundColor:"transparent", border:'2px solid #D9D9D9', padding:'10px 20px', borderRadius:"10px", color: "#fff", fontSize: "14px", fontWeight:'bold' }}
        flipButtons
        overlay
      >
        <h3>Cookie Preferences</h3>
        We use cookies to recognize visitors and analyze front end traffic and to support technical features that enhance your user experience. Read our {" "}
        <span style={{ color:"#2CE6F9" }}> <a href="/privacy-policy" target="_blank">Privacy</a> </span>
        and 
        <span style={{ color:"#2CE6F9" }}> <a href="/cookie-policy" target="_blank">Cookie</a> </span>
        Policies to learn more about how we use cookies.
      </CookieConsent>
    </div>
  );
};

export default CookiePopUp;
