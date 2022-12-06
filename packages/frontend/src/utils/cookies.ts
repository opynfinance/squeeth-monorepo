import Cookies from "js-cookie"
import { initializeAmplitude } from "./amplitude"
import * as Fathom from 'fathom-client'

const ACCEPT_COOKIE_FATHOM_EVENT_CODE = 'A4YYBAUT'
const REJECT_COOKIE_FATHOM_EVENT_CODE = '6WRWR0XB'

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
        expires: 365,
        sameSite:'Strict',
        path: '/'
    });

    if(consent){
        initializeAmplitude()
    }else {
        removeCookies()
    }
    trackCookieChoice(consent)
};

export const trackCookieChoice = (cookieChoice: boolean) => {

    if(cookieChoice){
        Fathom.trackGoal(ACCEPT_COOKIE_FATHOM_EVENT_CODE, 0)
    }else {
        Fathom.trackGoal(REJECT_COOKIE_FATHOM_EVENT_CODE, 0)
    }
    
}


