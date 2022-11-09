import Cookies from "js-cookie"

const removeCookies = (cookieName?: string,) => {
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

export default removeCookies