import Page from './page'
export default class Header extends Page {
  getConnectWalletBtn() {
    return cy.get('#connect-wallet')
  }
  getWalletAddress() {
    return cy.get('#wallet-address')
  }
}
