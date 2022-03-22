/* eslint-disable ui-testing/missing-assertion-in-test */
import TradePage from '../pages/trade'
import BigNumber from 'bignumber.js'
import { MIN_COLLATERAL_AMOUNT } from '../../../src/constants/index'

const trade = new TradePage()

describe('Trade on trade page', () => {
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

  context(`open short position`, () => {
    before(() => {
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
    })
    context(`when wallet has no eth balance`, () => {
      it('enter an amount into inputs will get error', () => {
        cy.get('#user-eth-wallet-balance').then((bal) => {
          if (Number(bal.text()) == 0) {
            cy.get('#open-short-eth-input').clear().type('1', { delay: 200, force: true })
            cy.get('#open-short-eth-input-box').should('contain.text', 'Insufficient ETH balance')
          }
        })
      })
    })
    context(`when wallet has eth balance`, () => {
      // it('eth balance should be greater than minimum collateral amount', () => {
      //   cy.get('#user-eth-wallet-balance').invoke('text').then(parseInt).should('be.at.least', MIN_COLLATERAL_AMOUNT)
      // })

      it('eth balance from wallet should be the same as balance of eth input box', () => {
        cy.get('#user-eth-wallet-balance').then((bal) => {
          cy.get('#open-short-eth-before-trade-balance').should('contain.text', Number(bal.text()).toFixed(4))
        })
      })

      it('open short input should be more than minimum collateral amount', () => {
        cy.get('#open-short-eth-input').clear().type('6.9', { delay: 200, force: true }).should('have.value', '6.90')
        cy.get('#open-short-eth-input').invoke('val').then(parseFloat).should('be.at.least', MIN_COLLATERAL_AMOUNT)
        cy.get('#open-short-eth-input-box').should('contain.text', 'Minimum collateral is')
      })

      it('inputs should be zero by default and tx button is disabled', () => {
        cy.get('#open-short-header-box').should('contain.text', 'Buy back oSQTH & open position')
        cy.get('#open-short-eth-input').should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#open-short-sumbit-tx-btn').should('be.disabled')
      })

      it('zero input amount', () => {
        cy.get('#open-short-eth-input').clear().type('0', { delay: 200, force: true }).should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      })

      it('invalid input amount', () => {
        cy.get('#open-short-eth-input').clear().type('\\', { delay: 200, force: true }).should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      })

      it('adjust collateral ratio', () => {
        cy.get('.open-short-collat-ratio-input-box')
          .clear()
          .type('250', { delay: 200, force: true })
          .should('have.value', '250')
      })

      it('can enter an amount into eth input, before & post trade amount match on position card and osqth input', () => {
        // cy.get('#open-short-eth-input').clear().type('1', { force: true, delay: 200 }).should('have.value', '1')
        cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
        cy.get('#open-short-eth-before-trade-balance').then((bal) => {
          cy.get('#open-short-eth-post-trade-balance').should('contain.text', (Number(bal.text()) - 8).toFixed(4))
        })

        cy.get('#open-short-trade-details .trade-details-amount').invoke('text').should('not.equal', '0')

        cy.get('#open-short-trade-details .trade-details-amount').then((val) => {
          cy.get('#open-short-osqth-before-trade-balance').then((bal) => {
            //post = before + input
            cy.get('#open-short-osqth-post-trade-balance').should(
              'contain.text',
              new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(4),
            )
          })
          cy.get('#position-card-before-trade-balance').then((bal) => {
            cy.get('#position-card-post-trade-balance').should(
              'contain.text',
              new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(6),
            )
          })
        })
      })

      it('can open short position for osqth', () => {
        cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
        cy.get('#open-short-trade-details .trade-details-amount').then((v) => {
          cy.get('#open-short-osqth-before-trade-balance').then((bal) => {
            const inputSqth = new BigNumber(v.val().toString()).toFixed(4)
            cy.get('#close-short-sumbit-tx-btn').then((btn) => {
              if (btn.text().includes('Allow wrapper')) {
                cy.get('#close-short-sumbit-tx-btn').click({ force: true })
                trade.confirmMetamaskTransaction()
                trade.waitForTransactionSuccess()
              }
              if (btn.text().includes('Deposit and sell')) {
                cy.get('#close-short-sumbit-tx-btn').click({ force: true })
                trade.confirmMetamaskTransaction()
                trade.waitForTransactionSuccess()
              }
            })
            cy.get('#open-short-sumbit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()

            cy.get('#open-short-card').should('contain.text', 'Close').should('contain.text', 'Opened')
            cy.get('#position-card-before-trade-balance').should(
              'contain.text',
              (Number(inputSqth) + Number(bal.text())).toFixed(6),
              { delay: 2000 },
            )
            cy.get('#conf-msg').should('contain.text', inputSqth)
          })
        })
        cy.get('#open-short-close-btn').click()
        cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
        cy.get('#open-short-eth-input').should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#open-short-sumbit-tx-btn').should('be.disabled')
      })
    })
  })
  context(`close short position`, () => {
    before(() => {
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
    })
    it('inputs should be zero by default and tx button is disabled', () => {
      cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
      cy.get('#close-short-osqth-input').should('have.value', '0')
      cy.get('#close-short-sumbit-tx-btn').should('be.disabled')
    })
    context(`when wallet has no short osqth balance`, () => {
      it('enter an amount into inputs will get error', () => {
        cy.get('#close-short-osqth-before-trade-balance').then((bal) => {
          if (Number(bal.text()) == 0) {
            cy.get('#close-short-osqth-input').clear().type('1', { delay: 200 })
            cy.get('#close-short-osqth-input-box').should('contain.text', 'Insufficient oSQTH balance')
          }
        })
      })
    })
    context(`when wallet has short osqth balance`, () => {
      it('zero input amount', () => {
        cy.get('close-short-type-select').select('Partial Close')
        cy.get('#close-short-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
      })

      it('invalid input amount', () => {
        cy.get('close-short-type-select').select('Partial Close')
        cy.get('#close-short-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
        cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
      })

      it('can enter an amount into osqth input, before & post trade amount match on position card and eth box', () => {
        cy.get('close-short-type-select').select('Partial Close')
        cy.get('#close-short-osqth-input')
          .clear()
          .type('0.001', { force: true, delay: 200 })
          .should('have.value', '0.001')
        cy.get('#open-short-osqth-before-trade-balance').then((val) => {
          cy.get('#open-short-osqth-post-trade-balance').should('contain.text', (Number(val.text()) - 0.001).toFixed(4))
          cy.get('#position-card-before-trade-balance').then((val) => {
            cy.get('#position-card-post-trade-balance').should('contain.text', (Number(val.text()) - 0.001).toFixed(4))
          })
        })

        cy.get('#close-short-trade-details  .trade-details-amount').should('not.equal', '0')
      })

      it('can use max button for osqth input when fully close selected', () => {
        cy.get('close-short-type-select').select('Partial Close')
        cy.get('#close-short-osqth-input-action').click()
        cy.get('#close-short-osqth-input').invoke('val').then(parseFloat).should('not.equal', '0')
        cy.get('close-short-type-select').should('contain.text', 'Fully Close')

        cy.get('#close-short-osqth-input').then((val) => {
          const osqthInput = new BigNumber(val.val().toString()).toFixed(6)
          cy.get('#close-short-osqth-before-trade-balance').should('contain.text', osqthInput)
          cy.get('#position-card-before-trade-balance').should('contain.text', osqthInput)
        })

        cy.get('#close-short-osqth-post-trade-balance').should('contain.text', (0).toFixed(4))
        cy.get('#position-card-post-trade-balance').should('contain.text', '0')
      })

      it('can close short position partially', () => {
        cy.get('close-short-type-select').select('Partial Close')
        cy.get('close-short-type-select').should('contain.text', 'Partial Close')

        cy.get('#close-short-osqth-input')
          .clear()
          .type('0.001', { force: true, delay: 200 })
          .should('have.value', '0.001')
        cy.get('#close-short-osqth-input').then((v) => {
          cy.get('#close-short-osqth-before-trade-balance').then((bal) => {
            const inputSqth = new BigNumber(v.val().toString()).toFixed(6)
            cy.get('#close-short-sumbit-tx-btn').then((btn) => {
              if (btn.text().includes('Allow wrapper')) {
                cy.get('#close-short-sumbit-tx-btn').click({ force: true })
                trade.confirmMetamaskTransaction()
                trade.waitForTransactionSuccess()
              }
              if (btn.text().includes('Buy back')) {
                cy.get('#close-short-sumbit-tx-btn').click({ force: true })
                trade.confirmMetamaskTransaction()
                trade.waitForTransactionSuccess()
              }
            })

            cy.get('#close-short-card').should('contain.text', 'Close').should('contain.text', 'Closed')
            cy.get('#position-card-before-trade-balance').should(
              'contain.text',
              (Number(bal.text()) - Number(inputSqth)).toFixed(6),
              { delay: 2000 },
            )
            cy.get('#conf-msg').should('contain.text', inputSqth)
          })
        })
        cy.get('#close-short-close-btn').click()
        cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
        cy.get('#close-short-trade-details .trade-details-amount').should('have.value', '0')
        cy.get('#close-short-osqth-input').should('have.value', '0')
        cy.get('#close-short-sumbit-tx-btn').should('be.disabled')
      })

      it(`close short position fully with fully close selected`, () => {
        cy.get('close-short-type-select').select('Fully Close')
        cy.get('close-short-type-select').should('contain.text', 'Fully Close')

        cy.get('#close-short-osqth-input').invoke('val').then(parseFloat).should('not.equal', '0')

        cy.get('#close-short-osqth-input').then((v) => {
          const inputSqth = new BigNumber(v.val().toString()).toFixed(6)
          cy.get('#close-short-sumbit-tx-btn').then((btn) => {
            if (btn.text().includes('Approve wrapper')) {
              cy.get('#close-short-sumbit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }
            if (btn.text().includes('Buy back')) {
              cy.get('#close-short-sumbit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }
          })

          cy.get('#close-short-card').should('contain.text', 'Close').should('contain.text', 'Closed')
          cy.get('#close-short-osqth-before-trade-balance').should('contain.text', 0)
          cy.get('#position-card-before-trade-balance').should('contain.text', 0)
          cy.get('#conf-msg').should('contain.text', inputSqth)
        })
        cy.get('#close-short-close-btn').click()
        cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
        cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#close-short-osqth-input').should('have.value', '0')
        cy.get('#close-short-sumbit-tx-btn').should('be.disabled')
      })
    })
  })
})
