import Cookies from "js-cookie"
import { initializeAmplitude } from "./amplitude"

export enum CookieNames {
    Consent = 'SqCookieControl',
  }

export const canStoreCookies = () => {
    return getCookie(CookieNames.Consent) == 'true' ? true : false 
}

export const getCookie = (cookieName: string,) => {
    return Cookies.get(cookieName)
}

export const removeCookies = (cookieName?: string,) => {
    if(cookieName){
        return Cookies.remove(cookieName)
    } else {
        // remove all 
        var cookie = document.cookie.split(';');
        for (var i = 0; i < cookie.length; i++) {
            var chip = cookie[i],
                entry = chip.split("="),
                name = entry[0];
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
    }
}

export const setCookie = (cookieName: string, identifier: string) => {

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
