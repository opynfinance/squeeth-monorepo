/// <reference types="cypress" />

const trade = new TradePage()
import TradePage from '../pages/trade'

//please run 04-buy or 04-mint first
//make sure you have buy or minted oSQTH balance
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

  context(`check lp balances on the vault page`, () => {
    it('check LP balances', () => {
      cy.get('#lp-vault-link a').invoke('removeAttr', 'target').click()
      cy.get('#vault-total-debt-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      cy.get('#vault-minted-debt-bal').invoke('text').then(parseFloat).should('eq', 0)
      cy.get('#vault-shorted-debt-bal').invoke('text').then(parseFloat).should('eq', 0)
    })
  })
})
