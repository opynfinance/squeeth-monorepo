/* eslint-disable ui-testing/missing-assertion-in-test */
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

  context(`Mint & buy squeeth on LP page`, () => {
    it('can mint on LP page', () => {
      cy.get('#lp-prev-step-btn').click({ force: true }).click({ force: true })
      cy.get('#current-lp-step').should('contain.text', '1')
      cy.get('#mint-sqth-to-lp-btn').click({ force: true })
      cy.get('#lp-page-mint-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
      cy.get('#current-lp-step').should('contain.text', '2')
      cy.get('#mint-to-lp-btn').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
      cy.get('#current-lp-step').should('contain.text', '3')
    })

    it('can buy squeeth on LP page', () => {
      cy.get('#lp-prev-step-btn').click({ force: true }).click({ force: true })
      cy.get('#current-lp-step').should('contain.text', '1')
      cy.get('#buy-sqth-to-lp-btn').click({ force: true })
      cy.get('#open-long-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
      cy.get('#open-long-sumbit-tx-btn').should('contain.text', 'Buy')
      cy.get('#open-long-sumbit-tx-btn').click({ force: true })
      cy.get('#current-lp-step').should('contain.text', '2')
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
      cy.get('#current-lp-step').should('contain.text', '3')
      cy.get('#open-long-close-btn').click()
    })
  })
})
