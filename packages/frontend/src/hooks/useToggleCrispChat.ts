import { useCallback } from 'react'

const useToggleCrispChat = () => {
  const windowObj: any = typeof window !== 'undefined' ? window : undefined

  const show = useCallback(() => {
    if (windowObj) {
      windowObj?.$crisp.push(['do', 'chat:show'])
    }
  }, [windowObj])

  const hide = useCallback(() => {
    if (windowObj) {
      windowObj?.$crisp?.push(['do', 'chat:hide'])
    }
  }, [windowObj])

  return { show, hide }
}

export default useToggleCrispChat
