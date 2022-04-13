/// <reference types="cypress" />
import TradePage from '../pages/trade'

const trade = new TradePage()

describe('Deposit and withdraw on strategy page', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit('/strategies')
    })
  })

  context('Connect metamask wallet', () => {
    it(`should login with success`, () => {
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()
      cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
    })
  })

  context('Deposit and withdraw', () => {
    context('can deposit and check position page', () => {
      before(() => {
        cy.visit('/strategies')
        trade.connectBrowserWallet()
      })

      it('can deposit', () => {
        cy.get('#crab-deposit-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
        cy.get('#crab-deposit-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#conf-msg').should('contain.text', 'Deposited 0.1000 ETH')
        cy.get('#crab-close-btn').click()
        // cy.get('#crab-pos-bal').should('not.contain.text', '--')
      })

      it('check results on pos page', () => {
        cy.visit('/positions')
        trade.connectBrowserWallet()
        cy.get('#pos-page-crab-deposited-amount').invoke('text').then(parseFloat).should('be.greaterThan', 0.09)
        cy.get('#pos-page-crab-pnl-amount').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      })
    })

    context('can withdraw and check position page', () => {
      before(() => {
        cy.visit('/strategies')
        trade.connectBrowserWallet()
      })
      it('can withdraw', () => {
        cy.get('#crab-withdraw-tab').click({ force: true })
        cy.get('#current-crab-eth-bal-input').should('not.equal', (0).toFixed(6))
        cy.get('#crab-withdraw-eth-input-action').click({ force: true })
        cy.get('#crab-withdraw-eth-input').then((v) => {
          cy.get('#current-crab-eth-bal-input').should('contain.text', Number(v.val()).toFixed(6))
        })
        cy.get('#crab-withdraw-btn').click({ force: true })

        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#conf-msg').should('contain.text', 'Withdrawn')
        cy.get('#crab-close-btn').click()
        // cy.get('#crab-pos-bal').should('contain.text', '--')
      })

      it('check results on pos page', () => {
        cy.visit('/positions')
        trade.connectBrowserWallet()
        cy.get('#pos-page-crab').should('not.exist')
      })
    })
  })
})
