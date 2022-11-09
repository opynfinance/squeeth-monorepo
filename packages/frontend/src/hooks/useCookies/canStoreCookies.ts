import { CookieNames } from "."
import getCookie from "./getCookie"

const canStoreCookies = () => {
    return getCookie(CookieNames.Consent) == 'true' ? true : false 
}

export default canStoreCookies