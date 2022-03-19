import Page from './page'
import Header from './header'
import Onboard from './onboard'
import Notifications from './notifications'

export default class TradePage extends Page {
  constructor() {
    super()
    this.header = new Header()
    this.onboard = new Onboard()
    this.notifications = new Notifications()
  }

  acceptMetamaskAccessRequest() {
    cy.acceptMetamaskAccess()
  }

  visit() {
    cy.visit('/')
  }

  connectBrowserWallet() {
    const connectWalletButton = this.header.getConnectWalletBtn()
    connectWalletButton.click()
    const onboardBrowserWalletButton = this.onboard.getBrowserWalletBtn()
    onboardBrowserWalletButton.click()
  }

  getLoggedInWalletAddress() {
    const addr = this.header.getWalletAddress()
    return addr.invoke('text')
  }

  waitForTransactionSuccess() {
    cy.waitUntil(
      () => {
        const txSuccessNotification = this.notifications.getTransactionSuccessNotification()
        return txSuccessNotification.should('exist')
      },
      {
        timeout: 90000000,
      },
    )
  }

  getTransactionUrl() {
    const txUrl = this.notifications.getTransactionSuccessNotificationLink()
    return txUrl.invoke('attr', 'href')
  }
}
