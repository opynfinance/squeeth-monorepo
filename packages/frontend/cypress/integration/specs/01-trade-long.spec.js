/// <reference types="cypress" />

import TradePage from '../pages/trade'
import BigNumber from 'bignumber.js'

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

  context('Trade switch checks', () => {
    it('check if there is open long card opened by default', () => {
      cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
    })

    it('switch between long & short, open & close trade cards with default 0 value', () => {
      cy.get('#long-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
      cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
      cy.get('#open-long-eth-input').should('have.value', '0')
      cy.get('#open-long-osqth-input').should('have.value', '0')
      // to make sure the cards are function independently after switching
      cy.get('#open-long-eth-input').type('2', { delay: 200 }).should('have.value', '2')

      cy.get('#long-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
      cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
      cy.get('#close-long-eth-input').should('have.value', '0')
      cy.get('#close-long-osqth-input').should('have.value', '0')
      cy.get('#close-long-eth-input').type('2', { delay: 200 }).should('have.value', '2')

      cy.get('#short-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
      cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
      cy.get('#open-short-eth-input').should('have.value', '0')
      cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      cy.get('#open-short-eth-input').type('2', { delay: 200 }).should('have.value', '2')

      cy.get('#short-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
      cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
      cy.get('#close-short-osqth-input').should('have.value', '0')
      cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
    })
  })

  let openLongoSQTHInput
  let openLongETHInput
  let closeLongoSQTHInput
  let closeLongETHInput
  let openLongOsqthBeforeTradeBal
  let posCardBeforeLongTradeBal
  let closeLongBeforeTradeBal

  context(`open long position`, () => {
    before('jump to open long trade card', () => {
      cy.get('#long-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
    })

    before(() => {
      it('eth balance should be greater than 0', () => {
        cy.get('#user-eth-wallet-balance').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      })
    })

    context('open long trade condition checks', () => {
      it('eth balance from wallet should be the same as eth input box', () => {
        cy.get('#user-eth-wallet-balance').then((bal) => {
          cy.get('#open-long-eth-before-trade-balance').should('contain.text', Number(bal.text()).toFixed(4))
        })
      })

      it('it is on open long card', () => {
        cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
      })
    })

    context('input checks', () => {
      // issue 277
      it.skip('inputs should be zero by default and tx button is disabled', () => {
        cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
        cy.get('#open-long-eth-input').should('have.value', '0')
        cy.get('#open-long-osqth-input').should('have.value', '0')
        cy.get('#open-long-submit-tx-btn').should('be.disabled')
      })

      it('zero input amount', () => {
        cy.get('#open-long-eth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        cy.get('#open-long-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
      })

      it('invalid input amount', () => {
        cy.get('#open-long-eth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
        cy.get('#open-long-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
      })
    })

    context('can enter an amount into eth input, check position card & input box balances', () => {
      it('can enter an amount into eth input', () => {
        cy.get('#open-long-eth-input').should('be.visible')
        cy.get('#open-long-eth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')

        cy.get('#open-long-osqth-input').should('not.equal', '0')
        cy.get('#open-long-osqth-input').then((v) => {
          openLongoSQTHInput = new BigNumber(v.val().toString())
        })
      })

      // a-post = a + input
      it('input box oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
          cy.get('#open-long-osqth-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(4)))
            .should('be.approximately', Number(openLongoSQTHInput.plus(Number(bal.text()))), 0.0002)
        })
      })

      // b-post = b + input
      it('position card oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#position-card-before-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(4)))
            .should('be.approximately', Number(openLongoSQTHInput.plus(Number(bal.text()))), 0.0002)
        })
      })

      // a = b
      it('position card oSQTH before trade balance should be the same as input box before oSQTH trade balance', () => {
        cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
      })

      // a + input = b + input != 0
      it('position card oSQTH post trade balance should be the same as input box post oSQTH trade balance and not equal 0', () => {
        cy.get('#open-long-osqth-post-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
        cy.get('#open-long-osqth-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#position-card-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })

      // eth-post = eth-before - openLongETHInput
      it('input box eth post trade balance should be the same as before-trade - input when input changes', () => {
        cy.get('#open-long-eth-before-trade-balance').then((bal) => {
          cy.get('#open-long-eth-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', (Number(bal.text()) - 1).toFixed(4))
        })
      })
    })

    context('can enter an amount into osqth input, check position card & input box balances', () => {
      it('can enter an amount into osqth input', () => {
        cy.get('#open-long-osqth-input').should('be.visible')
        cy.get('#open-long-osqth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')
        openLongoSQTHInput = new BigNumber(1)
      })

      // a-post = a + input
      it('input box oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
          cy.get('#open-long-osqth-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', openLongoSQTHInput.plus(Number(bal.text())).toFixed(4))
        })
      })

      // b-post = b + input
      it('position card oSQTH post trade balance should be the same as before-trade + input when input changes', () => {
        cy.get('#position-card-before-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', openLongoSQTHInput.plus(Number(bal.text())).toFixed(4))
        })
      })

      // a = b
      it('position card oSQTH before trade balance should be the same as input box before oSQTH trade balance', () => {
        cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
      })

      // a + input = b + input != 0
      it('position card oSQTH post trade balance should be the same as input box post oSQTH trade balance and not equal 0', () => {
        cy.get('#open-long-eth-input').then((bal) => {
          openLongETHInput = new BigNumber(bal.text().toString())
        })
        cy.get('#open-long-osqth-post-trade-balance').then((bal) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
        cy.get('#open-long-osqth-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#position-card-post-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })

      // eth-post = eth-before - openLongETHInput
      // issue #280
      it.skip('input box eth post trade balance should be the same as before-trade - input when input changes', () => {
        cy.get('#open-long-eth-before-trade-balance').then((bal) => {
          cy.get('#open-long-eth-post-trade-balance')
            .wait(15000)
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text()).minus(openLongETHInput).toFixed(4))
        })
      })
    })

    context('can open long position', () => {
      it('can open long position for osqth, and tx succeeds', () => {
        cy.get('#open-long-eth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')
        cy.get('#open-long-osqth-input').should('not.equal', '0')
        cy.get('#open-long-osqth-input').then((v) => {
          openLongoSQTHInput = new BigNumber(v.val().toString())
        })

        cy.get('#open-long-submit-tx-btn').should('contain.text', 'Buy')
        cy.get('#open-long-submit-tx-btn').should('not.be.disabled')

        cy.get('#open-long-osqth-before-trade-balance').then((val) => {
          openLongOsqthBeforeTradeBal = new BigNumber(val.text())
        })

        cy.get('#position-card-before-trade-balance').then((val) => {
          posCardBeforeLongTradeBal = new BigNumber(val.text())
        })

        cy.get('#open-long-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
      })

      it('there is open loong tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#open-long-card').should('contain.text', 'Close').should('contain.text', 'Bought')
        cy.get('#conf-msg').should('contain.text', openLongoSQTHInput.toFixed(6))
        cy.get('#open-long-close-btn').click({ force: true })
      })

      it('return to open long card successfully with all values update to 0', () => {
        cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
        cy.get('#open-long-eth-input').should('have.value', '0')
        cy.get('#open-long-osqth-input').should('have.value', '0')
        cy.get('#open-long-submit-tx-btn').should('be.disabled')
      })

      it('position card should update to new osqth balance', () => {
        // wait for 20 sec to update positon
        cy.get('#position-card-before-trade-balance')
          .wait(30000)
          .then((v) => Number(parseFloat(v.text()).toFixed(4)))
          .should('be.approximately', Number(posCardBeforeLongTradeBal.plus(openLongoSQTHInput)), 0.0002)
      })

      it('input box before trade update to new osqth balance', () => {
        cy.get('#open-long-osqth-before-trade-balance')
          .then((v) => Number(parseFloat(v.text()).toFixed(4)))
          .should('be.approximately', Number(openLongOsqthBeforeTradeBal.plus(openLongoSQTHInput)), 0.0002)
      })

      it('position card update to the same value as input box before trade balance and not equal 0', () => {
        cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
          cy.get('#position-card-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(4))
            .should('eq', new BigNumber(bal.text().toString()).toFixed(4))
        })
        cy.get('#open-long-osqth-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
        cy.get('#position-card-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })

      // issue #282
      it.skip('unrealized PnL display', () => {
        cy.get('#unrealized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })

      it('should have "close your long position to open a long" error in short oSQTH input when user have short oSQTH', () => {
        cy.get('#short-card-btn').click({ force: true })
        cy.get('#open-btn').click({ force: true })
        cy.get('#open-short-eth-input-box').should('contain.text', 'Close your long position to open a short')
      })
    })
  })

  context(`close long position`, () => {
    before(() => {
      cy.get('#long-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
    })

    context('close long trade condition checks', () => {
      it('it is on close long card', () => {
        cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
      })

      it('inputs should be zero by default and tx button is disabled', () => {
        cy.get('#close-long-eth-input').should('have.value', '0')
        cy.get('#close-long-osqth-input').should('have.value', '0')
        cy.get('#close-long-submit-tx-btn').should('be.disabled')
      })

      it('should have oSQTH long balance in position card', () => {
        cy.get('#position-card-before-trade-balance').invoke('text').then(parseFloat).should('not.equal', 0)
      })
    })

    context('input checks', () => {
      it('zero input amount', () => {
        cy.get('#close-long-eth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        cy.get('#close-long-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
      })

      it('invalid input amount', () => {
        cy.get('#close-long-eth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
        cy.get('#close-long-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
      })

      it('submit tx button should be disabled when input is zero', () => {
        cy.get('#close-long-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        cy.get('#close-long-submit-tx-btn').should('be.disabled')
      })
    })

    //1 input status check -> trade status check -> send tx -> post trade status check
    context('can close long with manual osqth inputs and tx succeeds', () => {
      it('can enter an amount into osqth input', () => {
        cy.get('#close-long-osqth-input').clear().type('0.1', { force: true, delay: 800 }).should('have.value', '0.1')
        cy.get('#close-long-eth-input').should('not.equal', '0')
        cy.get('#close-long-submit-tx-btn').should('not.be.disabled')
      })

      it('position card before trade balance should be the same as input box before trade balance', () => {
        cy.get('#position-card-before-trade-balance').then((val) => {
          cy.get('#close-long-osqth-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', Number(val.text()).toFixed(6))
        })
      })

      it('position card post trade balance should become before-trade - input when input changes', () => {
        cy.get('#position-card-before-trade-balance').then((val) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(6)))
            .should('be.approximately', Number(val.text()) - 0.1, 0.000002)
        })
      })

      it('input box before trade balance should become before-trade - input when input changes', () => {
        cy.get('#close-long-osqth-before-trade-balance').then((val) => {
          cy.get('#close-long-osqth-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(6)))
            .should('be.approximately', Number(val.text()) - 0.1, 0.000002)
        })
      })

      it('send tx', () => {
        cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
          closeLongBeforeTradeBal = bal.text()
        })

        cy.get('#position-card-before-trade-balance').then((bal) => {
          posCardBeforeLongTradeBal = bal.text()
        })

        cy.get('#close-long-submit-tx-btn').then((btn) => {
          if (btn.text().includes('Approve oSQTH')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskPermissionToSpend()
            trade.waitForTransactionSuccess()
            cy.wait(15000).get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          } else if (btn.text().includes('Sell')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })
      })

      it('there is close long tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
        cy.get('#conf-msg').should('contain.text', (0.1).toFixed(6))
        cy.get('#close-long-close-btn').click({ force: true })
      })

      it('new position card value should be the same as prev position card value', () => {
        // wait for 30 sec to update positon
        cy.get('#position-card-before-trade-balance')
          .wait(30000)
          .then((v) => Number(parseFloat(v.text()).toFixed(6)))
          .should('be.approximately', Number(posCardBeforeLongTradeBal) - 0.1, 0.000002)
      })

      // issue #280
      it.skip('new input box before trade value should be the same as the one before trade', () => {
        cy.get('#close-long-osqth-before-trade-balance')
          .then((v) => Number(parseFloat(v.text()).toFixed(6)))
          .should('be.approximately', Number(closeLongBeforeTradeBal) - 0.1, 0.000002)
      })

      it('return to close long card successfully', () => {
        cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
        cy.get('#close-long-eth-input').should('have.value', '0')
        cy.get('#close-long-osqth-input').should('have.value', '0')
        cy.get('#close-long-submit-tx-btn').should('be.disabled')
      })

      it('should have "close your long position" first error in short oSQTH input when user have long oSQTH', () => {
        cy.get('#short-card-btn').click({ force: true })
        cy.get('#open-btn').click({ force: true })
        cy.get('#open-short-eth-input-box').should('contain.text', 'Close your long position to open a short')
      })

      // issue #282
      it.skip('there should be unrealized PnL value', () => {
        cy.get('#unrealized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })

      it('there should be realized PnL value', () => {
        cy.get('#realized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })
    })

    context('close long with manual eth inputs and tx succeeds', () => {
      before(() => {
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      it('can enter an amount into eth input and tx succeeds', () => {
        cy.get('#close-long-eth-input').clear().type('0.1', { force: true, delay: 800 }).should('have.value', '0.1')
        cy.get('#close-long-osqth-input').should('not.equal', '0')
        cy.get('#close-long-submit-tx-btn').should('not.be.disabled')

        // wait for 15 secs for trade amount to load
        cy.get('#close-long-osqth-input')
          .wait(15000)
          .then((v) => {
            closeLongoSQTHInput = new BigNumber(v.val().toString())
          })
      })

      it('position card before trade balance should be the same as input box before trade balance', () => {
        cy.get('#position-card-before-trade-balance').then((val) => {
          cy.get('#close-long-osqth-before-trade-balance')
            .then((v) => Number(v.text()).toFixed(6))
            .should('eq', Number(val.text()).toFixed(6))
        })
      })

      it('position card post trade balance should become before-trade - input when input changes', () => {
        cy.get('#position-card-before-trade-balance').then((val) => {
          cy.get('#position-card-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(6)))
            .should('be.approximately', Number(new BigNumber(val.text()).minus(closeLongoSQTHInput)), 0.0002)
        })
      })

      it('input box before trade balance should become before-trade - input when input changes', () => {
        cy.get('#close-long-osqth-before-trade-balance').then((val) => {
          cy.get('#close-long-osqth-post-trade-balance')
            .then((v) => Number(parseFloat(v.text()).toFixed(6)))
            .should('be.approximately', Number(new BigNumber(val.text()).minus(closeLongoSQTHInput)), 0.0002)
        })
      })

      it('send tx', () => {
        cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
          closeLongBeforeTradeBal = new BigNumber(bal.text().toString())
        })

        cy.get('#position-card-before-trade-balance').then((bal) => {
          posCardBeforeLongTradeBal = new BigNumber(bal.text().toString())
        })
        cy.get('#close-long-submit-tx-btn').then((btn) => {
          if (btn.text().includes('Approve oSQTH')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskPermissionToSpend()
            trade.waitForTransactionSuccess()
            cy.wait(15000).get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          } else if (btn.text().includes('Sell')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })
      })

      it('there is close long tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
        cy.get('#conf-msg').should('contain.text', closeLongoSQTHInput.toFixed(6))
        cy.get('#close-long-close-btn').click({ force: true })
      })

      it('new position card value should be the same as prev position card value', () => {
        // wait for 30 sec to update positon
        cy.get('#position-card-before-trade-balance')
          .wait(30000)
          .then((v) => Number(parseFloat(v.text()).toFixed(6)))
          .should('be.approximately', Number(posCardBeforeLongTradeBal.minus(closeLongoSQTHInput)), 0.000002)
      })

      it.skip('new input box before trade value should be the same as the one before trade', () => {
        // issue #280
        cy.get('#close-long-osqth-before-trade-balance')
          .then((v) => Number(parseFloat(v.text()).toFixed(6)))
          .should('be.approximately', Number(closeLongBeforeTradeBal.minus(closeLongoSQTHInput)), 0.000002)
      })

      it('return to close long card successfully', () => {
        cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
        cy.get('#close-long-eth-input').should('have.value', '0')
        cy.get('#close-long-osqth-input').should('have.value', '0')
        cy.get('#close-long-submit-tx-btn').should('be.disabled')
      })

      it('should have "close your long position" first error in short oSQTH input when user have long oSQTH', () => {
        cy.get('#short-card-btn').click({ force: true })
        cy.get('#open-btn').click({ force: true })
        cy.get('#open-short-eth-input-box').should('contain.text', 'Close your long position to open a short')
      })

      // issue #282
      it.skip('there should be unrealized PnL value', () => {
        cy.get('#unrealized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })

      it('there should be realized PnL value', () => {
        cy.get('#realized-pnl-value').should('not.contain.text', 'Loading').should('not.contain.text', '--')
      })
    })

    context('close long position with max button and tx succeeds', () => {
      before(() => {
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      // issue #280, sometimes get incorrect amount to close due to loading issue
      it('can use max button for close long osqth input and tx succeeds', () => {
        cy.get('#close-long-osqth-input-action').click()
        cy.get('#close-long-osqth-input').should('not.equal', '0')
        cy.get('#close-long-eth-input').should('not.equal', '0')
        cy.get('#close-long-submit-tx-btn').should('not.be.disabled')

        cy.get('#close-long-osqth-input')
          .wait(15000)
          .then((v) => {
            closeLongoSQTHInput = new BigNumber(v.val().toString())
          })
      })

      it('send tx', () => {
        cy.get('#close-long-submit-tx-btn').then((btn) => {
          if (btn.text().includes('Approve oSQTH')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskPermissionToSpend()
            trade.waitForTransactionSuccess()
            cy.wait(15000).get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          } else if (btn.text().includes('Sell')) {
            cy.get('#close-long-submit-tx-btn').click({ force: true })
            trade.confirmMetamaskTransaction()
            trade.waitForTransactionSuccess()
          }
        })
      })

      // issue #286
      it.skip('there is close long tx finished card after tx succeeds with correct closing value', () => {
        cy.get('#close-long-card').should('contain.text', 'Close').should('contain.text', 'Sold')
        cy.get('#conf-msg').should('contain.text', closeLongoSQTHInput.toFixed(6))
        cy.get('#close-long-close-btn').click({ force: true })
      })

      it('return to close long card successfully with all values update to 0', () => {
        cy.get('#close-long-close-btn').click({ force: true })
        cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
        cy.get('#close-long-eth-input').should('have.value', '0')
        cy.get('#close-long-osqth-input').should('have.value', '0')
        cy.get('#close-long-submit-tx-btn').should('be.disabled')
      })

      it('position card should update to 0', () => {
        cy.get('#position-card-before-trade-balance').should('contain.text', '0')
      })

      // issue 280
      it.skip('input box before trade balance should update to 0', () => {
        cy.get('#close-long-osqth-before-trade-balance').should('contain.text', '0')
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
