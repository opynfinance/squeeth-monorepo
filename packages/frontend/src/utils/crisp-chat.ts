import { Crisp } from 'crisp-sdk-web'

export function sendCrispChatMessage(text: string) {
  Crisp.message.send('text', text)
}

export function openCrispChat() {
  Crisp.chat.open()
}

export function hideCrispChat() {
  Crisp.chat.hide()
}

export function showCrispChat() {
  Crisp.chat.show()
}
