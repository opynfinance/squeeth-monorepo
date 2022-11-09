import { initializeAmplitude } from "@utils/amplitude";
import Cookies from "js-cookie";
import removeCookies from "./removeCookies";

const setCookie = (cookieName: string, identifier: string) => {

    const consent = (identifier == 'true') ? true : false
    // save to cookie storage
    Cookies.set(cookieName,identifier, {
        expires: (consent) ? 365 : 10,
        sameSite:'Strict',
        path: '/'
    });

    if(consent){
        initializeAmplitude()
    }else {
        removeCookies()
    }
};

export default setCookie