/// <reference types="cypress" />
import TradePage from '../pages/trade'
const trade = new TradePage()

describe('Mint or Buy on LP page', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit('/lp')
    })
  })
  context('Connect metamask wallet', () => {
    it(`should login with success`, () => {
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()
      cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
    })
  })

  context(`can buy squeeth on LP page`, () => {
    it('can jump to buy card', () => {
      cy.get('#lp-prev-step-btn').click({ force: true }).click({ force: true })
      cy.get('#current-lp-step').should('contain.text', '1')
      cy.get('#buy-sqth-to-lp-btn').click({ force: true })
    })
    it('can buy squeeth on LP page', () => {
      cy.get('#open-long-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
      cy.get('#open-long-submit-tx-btn').should('contain.text', 'Buy')
      cy.get('#current-lp-step').should('contain.text', '2')
      cy.get('#open-long-submit-tx-btn').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
    })
    it('tx succeed and jump to lp window', () => {
      cy.get('#current-lp-step').should('contain.text', '3')
    })
  })
})
