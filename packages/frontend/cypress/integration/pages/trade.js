import Page from './page'
import Header from './header'
import Onboard from './onboard'
import Notifications from './notifications.js'

export default class TradePage extends Page {
  constructor() {
    super()
    this.header = new Header()
    this.onboard = new Onboard()
    this.notifications = new Notifications()
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
        // tx takes a bit longer so extend the timeout duration, wait for 200000 ms
        timeout: 200000,
      },
    )
  }

  getTransactionUrl() {
    const txUrl = this.notifications.getTransactionSuccessNotificationLink()
    return txUrl.invoke('attr', 'href')
  }
}
