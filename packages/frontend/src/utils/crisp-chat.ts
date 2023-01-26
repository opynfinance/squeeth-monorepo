const windowObj: any = typeof window !== 'undefined' ? window : undefined

export function sendCrispChatMessage(text: string) {
  windowObj && windowObj?.$crisp.push(['do', 'message:send', ['text', text]])
}

export function openCrispChat() {
  windowObj && windowObj?.$crisp.push(['do', 'chat:open'])
}
