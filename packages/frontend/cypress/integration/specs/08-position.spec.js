/// <reference types="cypress" />
import TradePage from '../pages/trade'

const trade = new TradePage()

describe('Trade and see if results are correct on position page', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit('/')
    })
  })
  context('Connect metamask wallet', () => {
    it(`should login with success`, () => {
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()

      cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
    })
  })

  context(`open long position and check pos page`, () => {
    before(() => {
      cy.get('#long-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
    })
    it('open long position and check pos page', () => {
      cy.get('#open-long-osqth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
      cy.get('#open-long-submit-tx-btn').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
      cy.get('#open-long-close-btn').click({ force: true })
    })

    it('check results on pos page', () => {
      cy.visit('/positions')
      trade.connectBrowserWallet()
      cy.get('#pos-page-long-osqth-bal').invoke('text').then(parseFloat).should('equal', 0.1)
    })
  })

  context(`close long position and check pos page`, () => {
    before(() => {
      cy.visit('/')
      trade.connectBrowserWallet()
      cy.get('#long-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
    })
    it('close long position and check pos page', () => {
      cy.get('#close-long-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
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

    it('check results on pos page', () => {
      cy.visit('/positions')
      trade.connectBrowserWallet()
      cy.get('#pos-page-long-osqth-bal').should('not.exist')
    })
  })

  context(`open short position and check pos page`, () => {
    before(() => {
      cy.visit('/')
      trade.connectBrowserWallet()
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
    })
    it('can open short position', () => {
      cy.get('#user-eth-wallet-balance').invoke('text').then(parseFloat).should('be.at.least', 8)
      cy.get('#trade-card').parent().scrollTo('top')
      cy.get('#open-short-eth-input').should('be.visible')
      cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')

      cy.get('#open-short-submit-tx-btn').then((btn) => {
        if (btn.text().includes('Allow wrapper')) {
          cy.get('#open-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#open-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        }
        if (btn.text().includes('Deposit and sell')) {
          cy.get('#open-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        }
      })
    })
    it('check results on pos page', () => {
      cy.visit('/positions')
      trade.connectBrowserWallet()
      cy.get('#pos-page-short-osqth-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
    })
  })

  context(`close short position and check pos page`, () => {
    before(() => {
      cy.visit('/')
      trade.connectBrowserWallet()
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
    })

    it('close short position', () => {
      cy.get('#close-short-type-select').should('contain.text', 'Full Close')

      cy.get('#close-short-submit-tx-btn').then((btn) => {
        if (btn.text().includes('Allow wrapper')) {
          cy.get('#close-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#close-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        } else if (btn.text().includes('Buy back')) {
          cy.get('#close-short-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        }
      })
    })

    it('check results on pos page', () => {
      cy.visit('/positions')
      trade.connectBrowserWallet()
      cy.get('#pos-page-short-osqth-bal').should('not.exist')
    })
  })

  context(`create and check mint fist and manual short position`, () => {
    context('mint and check pos page', () => {
      before(() => {
        cy.visit('/lp')
        trade.connectBrowserWallet()
      })
      it('mint', () => {
        cy.get('#lp-page-mint-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
        cy.get('#current-lp-step').should('contain.text', '2')
        cy.get('#mint-to-lp-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
      })
      it('check results on pos page', () => {
        cy.visit('/positions')
        trade.connectBrowserWallet()
        cy.get('#pos-page-minted-osqth-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      })
    })

    context('create manually short position and check pos page', () => {
      before(() => {
        cy.visit('/')
        trade.connectBrowserWallet()
        cy.get('#open-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      it('create manually short position', () => {
        cy.get('#close-long-eth-input-action').click()
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
        cy.get('#close-long-close-btn').click()
      })
      it('check results on pos page', () => {
        cy.visit('/positions')
        trade.connectBrowserWallet()
        cy.get('#pos-page-short-osqth-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      })
    })
  })
})
