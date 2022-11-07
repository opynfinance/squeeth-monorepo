

import Cookies from "js-cookie"


const removeCookie = (cookieName: string,) => {
    return Cookies.remove(cookieName)
}

export default removeCookie