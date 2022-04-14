/// <reference types="cypress" />
import BigNumber from 'bignumber.js'
import TradePage from '../pages/trade'

const trade = new TradePage()

// need to change close long component to manually sell osqth, add these two lines:
// const mintedDebt = useMintedDebt()
// const longSqthBal = mintedDebt

describe('Trade on trade page', () => {
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
  context('can create short position in 2 sep txs', () => {
    it('can mint first on LP page', () => {
      cy.get('#lp-prev-step-btn').click({ force: true }).click({ force: true })
      cy.get('#mint-sqth-to-lp-btn').click({ force: true })
      cy.get('#lp-page-mint-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
      cy.get('#mint-to-lp-btn').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
    })
    context(`sell minted squth, which is create short position`, () => {
      before(() => {
        cy.visit('/')
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      it('can create short position with manual selling with custom input', () => {
        cy.get('#close-long-osqth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
        cy.get('#close-long-submit-tx-btn').then((btn) => {
          if (btn.text().includes('Approve oSQTH')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskPermissionToSpend()
            trade.waitForTransactionSuccess()
            cy.wait(15000).get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
          if (btn.text().includes('Sell')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })
      })
      it('there is tx finished card with correct trade amount', () => {
        cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
        cy.get('#conf-msg').should('contain.text', Number(0.1).toFixed(6))
        cy.get('#close-long-close-btn').click()
      })

      it('check position card with correct short position', () => {
        cy.get('#position-card-before-trade-balance').wait(15000).should('contain.text', Number(0.1).toFixed(6))
      })
    })
  })
})
