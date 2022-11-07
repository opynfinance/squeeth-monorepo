import Cookies from "js-cookie";
import { getCookieConsentValue } from "react-cookie-consent";


const setCookie = (cookieName: string, identifier: string) => {
    //check constent given
    if(getCookieConsentValue()){
        // save to cookie storage
        Cookies.set(cookieName,identifier, {
            expires: 150,
            sameSite:'Strict',
            path: '/'
        });

        // save on thirdparty (Amplitude)
    }
};

export default setCookie