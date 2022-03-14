import Page from './page'
export default class Header extends Page {
  getConnectWalletBtn() {
    return cy.findByTestId('connect-wallet')
  }

  getWalletAddress() {
    return cy.findByTestId('wallet-address')
  }
}
