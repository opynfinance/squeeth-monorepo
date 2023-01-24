import useToggleCrispChat from '@hooks/useToggleCrispChat'
import { useEffect } from 'react'

export function CrispChat() {
  const { hide } = useToggleCrispChat()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const windowObj: any = window
    windowObj.$crisp = []
    windowObj.CRISP_WEBSITE_ID = '6e65ac5d-018b-4df7-ad69-710d711ab166'
    ;(function () {
      const d = document
      const s: any = d.createElement('script')

      s.src = 'https://client.crisp.chat/l.js'
      s.async = 1
      d.getElementsByTagName('head')[0].appendChild(s)
    })()
    hide()
  }, [])
  return null
}

export default CrispChat
