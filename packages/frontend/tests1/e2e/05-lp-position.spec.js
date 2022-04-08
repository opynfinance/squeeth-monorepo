/// <reference types="cypress" />

const trade = new TradePage()
import TradePage from '../pages/trade'

//please run 04-buy or 04-mint first
describe.skip('LP squeeth on uniswap', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit('/positions')
    })
  })
  context('Connect metamask wallet', () => {
    it(`should login with success`, () => {
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()
      cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
    })
  })

  context(`check lp positions on the position page`, () => {
    it(`Before tests`, () => {
      //not opening new tab
      cy.get('#lp-vault-link a').invoke('removeAttr', 'target').click()
    })
    it('check lp positions', () => {
      cy.get('#pos-page-lped-osqth-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
    })
  })
})
