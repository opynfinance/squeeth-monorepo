/* eslint-disable ui-testing/missing-assertion-in-test */
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
      cy.get('#current-lp-step').should('contain.text', '1')
      cy.get('#mint-sqth-to-lp-btn').click({ force: true })
      cy.get('#lp-page-mint-eth-input').clear().type('8.0', { force: true, delay: 200 }).should('have.value', '8.0')
      cy.get('#current-lp-step').should('contain.text', '2')
      cy.get('#mint-to-lp-btn').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
      cy.get('#current-lp-step').should('contain.text', '3')
    })
    context(`sell minted squth, which is create short position`, () => {
      before(() => {
        cy.visit('/')
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      it('can create short position with manual selling with custom input', () => {
        cy.get('#close-long-osqth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
        cy.get('#close-long-sumbit-tx-btn').then((btn) => {
          if (btn.text().includes('Approve oSQTH')) {
            cy.get('#close-long-sumbit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
          if (btn.text().includes('Sell')) {
            cy.get('#close-long-sumbit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })

        cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
        cy.get('#position-card-before-trade-balance').should('contain.text', Number(0.1).toFixed(6), {
          delay: 2000,
        })
        //should have short position on pos card
        cy.get('#conf-msg').should('contain.text', Number(0.1).toFixed(6))
        cy.get('#close-long-close-btn').click()
      })

      it(`create short position with max button`, () => {
        cy.get('#close-long-eth-input-action').click()
        cy.get('#close-long-osqth-input').should('not.equal', '0')

        cy.get('#close-long-osqth-input').then((v) => {
          const inputSqth = new BigNumber(v.val().toString()).toFixed(6)
          cy.get('#close-long-sumbit-tx-btn').then((btn) => {
            if (btn.text().includes('Approve oSQTH')) {
              cy.get('#close-long-sumbit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }

            if (btn.text().includes('Sell')) {
              cy.get('#close-long-sumbit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }
          })

          cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
          //should have short position on pos card
          cy.get('#position-card-before-trade-balance').should('contain.text', Number(inputSqth).toFixed(6), {
            delay: 2000,
          })
          cy.get('#conf-msg').should('contain.text', inputSqth)
        })
        cy.get('#close-long-close-btn').click()
      })
    })
  })
})
