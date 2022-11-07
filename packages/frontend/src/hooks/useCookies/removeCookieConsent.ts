import { resetCookieConsentValue } from "react-cookie-consent"


const removeCookieConsent = (cookieName: string) => {
    return resetCookieConsentValue(cookieName)
}
export default removeCookieConsent