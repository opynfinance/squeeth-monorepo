/// <reference types="cypress" />
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

  let openShortOsqthInput
  let openShortOsqthBeforeTradeBal
  let posCardBeforeShortTradeBal

  context(`open short position`, () => {
    before('jump to open short trade card', () => {
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
    })

    before(() => {
      it('eth balance should be greater than minimum collateral amount', () => {
        cy.get('#user-eth-wallet-balance').invoke('text').then(parseFloat).should('be.at.least', MIN_COLLATERAL_AMOUNT)
      })
    })

    context('open short trade condition checks', () => {
      it('eth balance from wallet should be the same as balance of eth input box', () => {
        cy.get('#user-eth-wallet-balance').then((bal) => {
          cy.get('#open-short-eth-before-trade-balance').should('contain.text', Number(bal.text()))
        })
      })

      it('it is on open short card', () => {
        cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
      })
    })

    context('input checks', () => {
      it('inputs should be zero by default and tx button is disabled', () => {
        cy.get('#open-short-eth-input').should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#open-short-submit-tx-btn').should('be.disabled')
      })

      it('open short input should be more than minimum collateral amount', () => {
        cy.get('#open-short-eth-input').clear().type('6.9', { delay: 200, force: true }).should('have.value', '6.90')
        cy.get('#open-short-eth-input').invoke('val').then(parseFloat).should('be.at.least', MIN_COLLATERAL_AMOUNT)
      })

      it('zero input amount', () => {
        cy.get('#trade-card').parent().scrollTo('top')
        cy.get('#open-short-eth-input').should('be.visible')
        cy.get('#open-short-eth-input').clear().type('0', { delay: 200, force: true }).should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      })

      it('invalid input amount', () => {
        cy.get('#trade-card').parent().scrollTo('top')
        cy.get('#open-short-eth-input').should('be.visible')
        cy.get('#open-short-eth-input').clear().type('\\', { delay: 200, force: true }).should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      })
    })

    context('can enter an amount into osqth input, check position card & input box balances', () => {
      it('can enter an amount into eth input', () => {
        cy.get('#trade-card').parent().scrollTo('top')
        cy.get('#open-short-eth-input').should('be.visible')
        cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')
        cy.get('#open-short-trade-details .trade-details-amount').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#open-short-trade-details .trade-details-amount').then((val) => {
          openShortOsqthInput = new BigNumber(val.text())
        })
      })

      // post = before + input
      // a = input box oSQTH before trade balance
      // a-post = a + input
      it('input box oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#open-short-osqth-before-trade-balance').then((bal) => {
          cy.get('#open-short-osqth-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', openShortOsqthInput.plus(Number(bal.text())).toFixed(4))
        })
      })

      // b = position card oSQTH before trade balance
      // b-post = b + input
      it('position card oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#position-card-before-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', openShortOsqthInput.plus(Number(bal.text())).toFixed(4))
        })
      })

      // a = b
      it('position card oSQTH before trade balance should be the same as input box before oSQTH trade balance', () => {
        cy.get('#open-short-osqth-before-trade-balance').then((bal) => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
      })

      // a + input = b + input != 0
      it('position card oSQTH post trade balance should be the same as input box post oSQTH trade balance and not equal 0', () => {
        cy.get('#open-short-osqth-post-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
        cy.get('#open-short-osqth-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#position-card-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })

      // eth-post = eth-before - 8
      it('input box eth post trade balance should be the same as before-trade - input when input changes', () => {
        cy.get('#open-short-eth-before-trade-balance').then((bal) => {
          cy.get('#open-short-eth-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', (Number(bal.text()) - 8).toFixed(4))
        })
      })

      it('can adjust collateral ratio', () => {
        cy.get('.open-short-collat-ratio-input-box input')
          .clear()
          .type('250.', { delay: 200, force: true })
          .should('have.value', '250.0')
      })
    })

    context('open short position', () => {
      it('can open short position for osqth, and tx succeeds', () => {
        cy.get('#trade-card').parent().scrollTo('top')
        cy.get('#open-short-eth-input').should('be.visible')
        cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')

        cy.get('#open-short-trade-details .trade-details-amount').then((val) => {
          openShortOsqthInput = new BigNumber(val.text())
        })

        cy.get('#open-short-osqth-before-trade-balance').then((val) => {
          openShortOsqthBeforeTradeBal = new BigNumber(val.text())
        })

        cy.get('#position-card-before-trade-balance').then((val) => {
          posCardBeforeShortTradeBal = new BigNumber(val.text())
        })

        cy.get('#open-short-submit-tx-btn').then((btn) => {
          if (btn.text().includes('Allow wrapper')) {
            cy.get('#open-short-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
            cy.get('#open-short-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          } else if (btn.text().includes('Deposit and sell')) {
            cy.get('#open-short-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })
      })

      it('there is open short tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#open-short-card').should('contain.text', 'Close').should('contain.text', 'Opened')
        cy.get('#conf-msg').should('contain.text', openShortOsqthInput.toFixed(6))
        cy.get('#open-short-close-btn').click({ force: true })
      })

      it('return to open short card successfully with all values update to 0', () => {
        cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
        cy.get('#open-short-eth-input').should('have.value', '0')
        cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#open-short-submit-tx-btn').should('be.disabled')
      })

      it('position card should update to new osqth balance', () => {
        // wait for 20 sec to update positon
        cy.get('#position-card-before-trade-balance')
          .wait(30000)
          .then((v) => Number(parseFloat(v.text()).toFixed(4)))
          .should('be.approximately', Number(posCardBeforeShortTradeBal.plus(openShortOsqthInput)), 0.0002)
      })

      it('input box before trade update to new osqth balance', () => {
        cy.get('#open-short-osqth-before-trade-balance')
          .then((v) => Number(parseFloat(v.text()).toFixed(4)))
          .should('be.approximately', Number(openShortOsqthBeforeTradeBal.plus(openShortOsqthInput)), 0.0002)
      })

      it('position card update to the same value as input box before trade balance and not equal 0', () => {
        cy.get('#open-short-osqth-before-trade-balance').then((bal) => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
        cy.get('#open-short-osqth-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#position-card-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })

      // issue #282
      it.skip('unrealized PnL display', () => {
        cy.get('#unrealized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })

      it('should have "close your short position" first error in long oSQTH input when user have short oSQTH', () => {
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#open-btn').click({ force: true })
        cy.get('#open-long-eth-input-box').should('contain.text', 'Close your short position to open a long')
      })
    })
  })

  context(`when have short oSQTH balance, the default trade card would be short`, () => {
    // issue #278
    it.skip('reload to see if by default is short & open trade cards', () => {
      cy.reload()
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()
      cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
      cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
    })
  })

  let closeShortBeforeTradeBal
  let maxBtnShortCloseInput
  let fullShortCloseInput

  context(`close short position`, () => {
    before('jump to close short card', () => {
      cy.get('#short-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
    })

    context('close short position partially', () => {
      context('close short trade condition checks', () => {
        it('it is on close short card', () => {
          cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
        })

        // loading issues
        it.skip('should select full close by default and there should be oSQTH short balance in input, input shoulde be disabled and tx button is not disabled', () => {
          cy.get('#close-short-type-select').should('contain.text', 'Full Close')
          cy.get('#close-short-osqth-input').should('not.equal', '0')

          cy.get('#close-short-trade-details .trade-details-amount')
            .invoke('text')
            .then(parseFloat)
            .should('not.equal', 0)

          cy.get('#close-short-osqth-input').should('be.disabled')
          cy.get('#close-short-submit-tx-btn').should('not.be.disabled')
        })

        it('should have oSQTH short balance in position card', () => {
          cy.get('#position-card-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        })
      })

      context('input checks', () => {
        it('zero input amount when partial close is selected', () => {
          cy.get('#close-short-type-select .MuiSelect-select').wait(10000).click({ force: true })
          cy.get('#close-short-partial-close').click({ force: true })
          cy.get('#close-short-type-select').should('contain.text', 'Partial Close')
          cy.get('#close-short-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
          cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
        })

        it('invalid input amount when partial close is selected', () => {
          cy.get('#close-short-type-select .MuiSelect-select').click({ force: true })
          cy.get('#close-short-partial-close').click({ force: true })
          cy.get('#close-short-type-select').should('contain.text', 'Partial Close')
          cy.get('#close-short-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
          cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
        })

        it('submit tx button should be disabled when input is zero', () => {
          cy.get('#close-short-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
          cy.get('#close-short-submit-tx-btn').should('be.disabled')
        })
      })

      context('can enter an amount into osqth input', () => {
        it('select partial close and have manual input', () => {
          cy.get('#close-short-type-select .MuiSelect-select').click({ force: true })
          cy.get('#close-short-partial-close').click({ force: true })
          cy.get('#close-short-type-select').wait(2000).should('contain.text', 'Partial Close')

          cy.get('#close-short-osqth-input')
            .clear()
            .type('0.1', { force: true, delay: 800 })
            .should('have.value', '0.1')

          // make sure it's able to close short partially
          cy.get('.close-short-collat-ratio-input-box input')
            .clear()
            .type('250.', { delay: 200, force: true })
            .should('have.value', '250.0')

          cy.get('#close-short-trade-details .trade-details-amount')
            .invoke('text')
            .then(parseFloat)
            .should('not.equal', 0)

          cy.get('#close-short-submit-tx-btn').should('not.be.disabled')
        })

        it('position card before trade balance should be the same as input box before trade balance', () => {
          cy.get('#position-card-before-trade-balance').then((val) => {
            cy.get('#close-short-osqth-before-trade-balance')
              .then((v) => Number(v.text()).toFixed(6))
              .should('eq', Number(val.text()).toFixed(6))
          })
        })

        it('position card post trade balance should become before-trade - input when input changes', () => {
          cy.get('#position-card-before-trade-balance').then((val) => {
            cy.get('#position-card-post-trade-balance')
              .then((v) => Number(v.text()).toFixed(6))
              .should('eq', (Number(val.text()) - 0.1).toFixed(6))
          })
        })

        it('input box before trade balance should become before-trade - input when input changes', () => {
          cy.get('#close-short-osqth-before-trade-balance').then((val) => {
            cy.get('#close-short-osqth-post-trade-balance')
              .then((v) => Number(v.text()).toFixed(6))
              .should('eq', (Number(val.text()) - 0.1).toFixed(6))
          })
        })
      })

      context('can use max button for osqth input when partially close first selected', () => {
        it('can select partial close first then full close', () => {
          cy.get('#close-short-type-select .MuiSelect-select').click({ force: true })
          cy.get('#close-short-partial-close').click({ force: true })
          cy.get('#close-short-type-select').should('contain.text', 'Partial Close')
          cy.get('#close-short-osqth-input-action').click()
          cy.get('#close-short-type-select').should('contain.text', 'Full Close')
          cy.get('#close-short-osqth-input').should('not.equal', '0')
          cy.get('#close-short-trade-details .trade-details-amount')
            .invoke('text')
            .then(parseFloat)
            .should('not.equal', 0)
          cy.get('#close-short-osqth-input').should('be.disabled')
          cy.get('#close-short-submit-tx-btn').should('not.be.disabled')

          cy.get('#close-short-osqth-input').then((val) => {
            maxBtnShortCloseInput = new BigNumber(val.val().toString()).toFixed(6)
          })
        })

        it('position card before trade balance should be the same as input when input changes', () => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', maxBtnShortCloseInput)
        })

        it('position card post trade balance should become 0 when input changes', () => {
          cy.get('#position-card-post-trade-balance').should('contain.text', '0')
        })

        it('input box before trade balance should be the same as input when input changes', () => {
          cy.get('#close-short-osqth-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', maxBtnShortCloseInput)
        })

        it('position card post trade balance should become 0 when input changes', () => {
          cy.get('#close-short-osqth-post-trade-balance').should('contain.text', (0).toFixed(6))
        })
      })

      context('close short position partially tx', () => {
        it('can close short position partially, and tx succeeds', () => {
          cy.get('#close-short-type-select .MuiSelect-select').click({ force: true })
          // issue #279
          cy.get('#close-short-partial-close').wait(2000).click({ force: true })
          cy.get('#close-short-type-select').should('contain.text', 'Partial Close')
          cy.get('#close-short-osqth-input').should('not.be.disabled')
          cy.get('#close-short-osqth-input')
            .clear()
            .type('0.01', { force: true, delay: 800 })
            .should('have.value', '0.01')

          // make sure it's able to close short partially
          cy.get('.close-short-collat-ratio-input-box input')
            .clear()
            .type('250.', { delay: 200, force: true })
            .should('have.value', '250.0')

          cy.get('#close-short-osqth-before-trade-balance').then((bal) => {
            closeShortBeforeTradeBal = bal.text()
          })

          cy.get('#position-card-before-trade-balance').then((bal) => {
            posCardBeforeShortTradeBal = bal.text()
          })

          cy.get('#close-short-submit-tx-btn').then((btn) => {
            if (btn.text().includes('Allow wrapper')) {
              cy.get('#close-short-submit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
              cy.get('#close-short-submit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }
            if (btn.text().includes('Buy back')) {
              cy.get('#close-short-submit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()
            }
          })
        })

        it('there is close short tx finished card after tx succeeds with correct closing value', () => {
          cy.get('#close-short-card').should('contain.text', 'Close').should('contain.text', 'Closed')
          cy.get('#conf-msg').should('contain.text', (0.01).toFixed(6))
          cy.get('#close-short-close-btn').click({ force: true })
        })

        it('new position card value should be the same as prev position card value', () => {
          // wait for 30 sec to update positon
          cy.get('#position-card-before-trade-balance')
            .wait(30000)
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', (Number(posCardBeforeShortTradeBal) - 0.01).toFixed(6))
        })

        it.skip('new input box before trade value should be the same as the one before trade', () => {
          // new input box before trade value should be the same as the one before trade
          // issue #280
          cy.get('#close-short-osqth-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', (Number(closeShortBeforeTradeBal) - 0.01).toFixed(6))
        })

        it('return to close short card successfully', () => {
          cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
          cy.get('#close-short-type-select').should('contain.text', 'Full Close')
          cy.get('#close-short-trade-details .trade-details-amount')
            .invoke('text')
            .then(parseFloat)
            .should('not.equal', 0)
          cy.get('#close-short-osqth-input').should('not.equal', '0').should('be.disabled')
          cy.get('#close-short-submit-tx-btn').should('not.be.disabled')
        })

        it('should have "close your short position" first error in long oSQTH input when user have short oSQTH', () => {
          cy.get('#long-card-btn').click({ force: true })
          cy.get('#open-btn').click({ force: true })
          cy.get('#open-long-eth-input-box').should('contain.text', 'Close your short position to open a long')
        })

        // issue #282
        it.skip('there should be unrealized PnL value', () => {
          cy.get('#unrealized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
        })

        it('there should be realized PnL value', () => {
          cy.get('#realized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
        })
      })
    })

    context('close short position fully tx', () => {
      before('jump to short close card', () => {
        cy.get('#short-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })

      it(`can close short position fully and tx succeeds`, () => {
        cy.get('#close-short-type-select .MuiSelect-select').click({ force: true })
        cy.get('#close-short-full-close').click({ force: true })
        cy.get('#close-short-type-select').should('contain.text', 'Full Close')
        cy.get('#close-short-osqth-input').should('not.equal', '0')
        cy.get('#close-short-osqth-input').then((bal) => {
          fullShortCloseInput = new BigNumber(bal.val().toString()).toFixed(6)
        })

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

      it('there is close short tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#close-short-card').should('contain.text', 'Close').should('contain.text', 'Closed')
        cy.get('#conf-msg').should('contain.text', fullShortCloseInput)
        cy.get('#close-short-close-btn').click({ force: true })
      })

      it('return to close short card successfully with all values update to 0', () => {
        cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
        cy.get('#close-short-type-select').should('contain.text', 'Full Close')
        cy.get('#close-short-osqth-input').should('have.value', '0')
        cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
        cy.get('#close-short-submit-tx-btn').should('be.disabled')
      })

      it('position card should update to 0', () => {
        cy.get('#position-card-before-trade-balance').should('contain.text', '0')
      })

      it('input box before trade balance should update to 0', () => {
        cy.get('#close-short-osqth-before-trade-balance').should('contain.text', '0')
      })

      // issue #281
      it.skip('Current CR in close short trade card is not updated to 0 after close out all of the short position', () => {
        cy.get('#close-short-collateral-ratio .trade-info-item-value').should('contain.text', '0')
      })

      it('unrealized PnL should be --', () => {
        cy.get('#unrealized-pnl-value').should('contain.text', '--')
      })

      it('realized PnL should be --', () => {
        cy.get('#realized-pnl-value').should('contain.text', '--')
      })
    })
  })
})
