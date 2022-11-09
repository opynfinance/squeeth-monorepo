import Cookies from "js-cookie"

const getCookie = (cookieName: string,) => {
    return Cookies.get(cookieName)
}

export default getCookie