/// <reference types="cypress" />
import BigNumber from 'bignumber.js'
import { kebabCase } from 'lodash'
import TradePage from '../pages/trade'

const trade = new TradePage()

describe('Do vault operations(mint debt, burn debt, add collat, remove collat) on vault page', () => {
  let openShortOsqthInput
  let mintWMaxButtonInput
  let liqpAfterTrade
  let crAfterTrade
  let shortedDebtBeforeMint
  let shortedDebtBeforeBurn
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

    it('can open short position', () => {
      cy.get('#user-eth-wallet-balance').invoke('text').then(parseFloat).should('be.at.least', 8)
      cy.get('#trade-card').parent().scrollTo('top')
      cy.get('#open-short-eth-input').should('be.visible')
      cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')

      cy.get('#open-short-trade-details .trade-details-amount').then((val) => {
        openShortOsqthInput = new BigNumber(val.text())
      })

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
  })

  context('Check the vault', () => {
    before(() => {
      //not opening new tab
      cy.get('#pos-card-manage-vault-link a').invoke('removeAttr', 'target').click().wait(20000)
    })

    context(`open short display value check`, () => {
      // issue 277
      it.skip(`input should be zero and button should be disabled by default`, () => {
        cy.get('#debt-amount-input').should('have.value', '0')
        cy.get('#collat-amount-input').should('have.value', '0')
        cy.get('#mint-submit-tx-btn').should('be.disabled')
        cy.get('#burn-submit-tx-btn').should('be.disabled')
        cy.get('#add-collat-submit-tx-btn').should('be.disabled')
        cy.get('#remove-collat-submit-tx-btn').should('be.disabled')
      })

      it(`eth balance from wallet should be the same as balance of eth input box`, () => {
        cy.get('#user-eth-wallet-balance').then((bal) => {
          cy.get('#vault-collat-input-eth-balance').should('contain.text', Number(bal.text()))
        })
      })

      it('vault collateral amount should be equal to 8', () => {
        cy.get('#vault-collat-amount').wait(10000).invoke('text').then(parseFloat).should('equal', 8)
      })
      // there will be slippage
      it.skip('total debt balance should be equal to the short amount opened', () => {
        cy.get('#vault-total-debt-bal').should('contain.text', openShortOsqthInput.toFixed(6))
      })
      // there will be slippage
      it.skip('short debt balance should be equal to the short amount opened', () => {
        cy.get('#vault-shorted-debt-bal').should('contain.text', openShortOsqthInput.toFixed(6))
      })

      it('other debt balances should be equal to 0', () => {
        cy.get('#vault-minted-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
      })
    })

    context(`adjust debt`, () => {
      context('Mint with manual input', () => {
        it(`can enter in debt input`, () => {
          cy.get('#debt-amount-input').clear().type('1', { delay: 200, force: true }).should('have.value', '1')
          cy.get('#mint-submit-tx-btn').should('not.be.disabled')
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#debt-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
          })
          cy.get('.debt-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
        })

        it('CR input should be above 150', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#mint-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#mint-submit-tx-btn').should('be.disabled')
          cy.get('#vault-debt-input-osqth-alance').invoke('text').then(parseFloat).should('equal', 1)
        })

        it('check minted debt balance after minted', () => {
          cy.get('#vault-minted-debt-bal').wait(20000).invoke('text').then(parseFloat).should('equal', 1)
        })

        it('check shorted debt balance after minted', () => {
          cy.get('#vault-shorted-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeMint.toFixed(6)))
        })

        it('check total debt balance after minted', () => {
          cy.get('#vault-total-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeMint.plus(1).toFixed(6)))
        })

        it('check lped debt balances after minted', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })

      // issue #238
      context.skip('can burn with manual input', () => {
        it(`can burn with manual input`, () => {
          cy.get('#debt-amount-input').clear().type('-1', { delay: 200, force: true }).should('have.value', '-1')
          cy.get('#burn-submit-tx-btn').should('not.be.disabled')
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeBurn = new BigNumber(val.text())
          })
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#debt-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
          })
          cy.get('.debt-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
        })

        it('CR should be above 150', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#burn-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#burn-submit-tx-btn').should('be.disabled')
          cy.get('#vault-debt-input-osqth-alance').invoke('text').then(parseFloat).should('equal', 1)
        })

        it('check minted debt balance after minted', () => {
          cy.get('#vault-minted-debt-bal').wait(20000).invoke('text').then(parseFloat).should('equal', 1)
        })

        it('check shorted debt balance after minted', () => {
          cy.get('#vault-shorted-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeBurn.minus(1).toFixed(6)))
        })

        it('check total debt balance after minted', () => {
          cy.get('#vault-total-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', shortedDebtBeforeBurn.minus(1).toFixed(6))
        })

        it('check lped debt balances after minted', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })

      context('Mint with max button input', () => {
        it(`can enter with max button`, () => {
          cy.get('#debt-amount-input').clear().type('1', { delay: 200, force: true }).should('have.value', '1')
          cy.get('#debt-max-btn').click({ force: true })
          cy.get('#mint-submit-tx-btn').should('not.be.disabled')
          cy.get('#debt-amount-input').then((val) => {
            mintWMaxButtonInput = new BigNumber(val.val().toString())
          })
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#debt-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
            cy.log(liqpAfterTrade)
          })
          cy.get('.debt-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
        })

        it('CR input should be above 150', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#mint-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#mint-submit-tx-btn').should('be.disabled')
          cy.get('#vault-debt-input-osqth-alance').invoke('text').then(parseFloat).should('equal', 1)
        })

        // issue #238
        it.skip('check minted debt balance after minted', () => {
          cy.get('#vault-minted-debt-bal')
            .wait(20000)
            .invoke('text')
            .then(parseFloat)
            .should('eq', mintWMaxButtonInput.toFixed(6))
        })

        it('check shorted debt balance after minted', () => {
          cy.get('#vault-shorted-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeMint.toFixed(6)))
        })

        // issue #238
        it.skip('check total debt balance after minted', () => {
          cy.get('#vault-total-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('be.approximately', Number(shortedDebtBeforeMint.plus(mintWMaxButtonInput).toFixed(6)), 0.000001)
        })

        it('check lped debt balances after minted', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })

      // issue #238
      context.skip('Burn with max button input', () => {
        it(`can burn with max button`, () => {
          cy.get('#debt-amount-input').clear().type('-1', { delay: 200, force: true }).should('have.value', '-1')
          cy.get('#debt-max-btn').click({ force: true })
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeBurn = new BigNumber(val.text())
          })
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#debt-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
          })
          cy.get('.debt-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
          cy.get('#burn-submit-tx-btn').should('not.be.disabled')
        })

        it('CR should be above 150', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#burn-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#burn-submit-tx-btn').should('be.disabled')
          cy.get('#vault-debt-input-osqth-alance').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('check minted debt balance after minted', () => {
          cy.get('#vault-minted-debt-bal').wait(20000).invoke('text').then(parseFloat).should('equal', 0)
        })

        it('check shorted debt balance after minted', () => {
          cy.get('#vault-shorted-debt-bal').invoke('text').then(parseFloat).should('eq', 0)
        })

        it('check total debt balance after minted', () => {
          cy.get('#vault-total-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', shortedDebtBeforeBurn.minus(1).toFixed(6))
        })

        it('check lped debt balances after minted', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })
    })

    context(`adjust collateral `, () => {
      context('add collat with manual input', () => {
        it(`can enter in collat input`, () => {
          cy.get('#collat-amount-input').clear().type('1', { delay: 200, force: true }).should('have.value', '1')
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#collat-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
          })
          cy.get('.collat-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
          cy.get('#add-collat-submit-tx-btn').should('not.be.disabled')
        })

        it('CR input should be above 150', () => {
          cy.get('.collat-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#add-collat-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#add-collat-submit-tx-btn').should('be.disabled')

          cy.get('#user-eth-wallet-balance').then((bal) => {
            cy.get('#vault-collat-input-eth-alance').should('contain.text', Number(bal.text()).toFixed(4))
          })
        })

        it('check vault collat amount', () => {
          cy.get('#vault-collat-amount').wait(20000).should('contain.text', (9).toFixed(4))
        })

        it('check shorted debt balance after collateral added', () => {
          cy.get('#vault-shorted-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeMint.toFixed(6)))
        })

        it('check lped debt balances after collateral added', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })

      context('remove Collat with manual input', () => {
        it(`can enter in collat input`, () => {
          cy.get('#collat-amount-input').clear().type('-1', { delay: 200, force: true }).should('have.value', '-1')
          cy.get('#vault-shorted-debt-bal').then((val) => {
            shortedDebtBeforeMint = new BigNumber(val.text())
          })
          cy.get('#collat-new-liqp .trade-info-item-value').then((val) => {
            liqpAfterTrade = val.text()
          })
          cy.get('.collat-collat-perct input').then((val) => {
            crAfterTrade = val.val()
          })
          cy.get('#remove-collat-submit-tx-btn').should('not.be.disabled')
        })

        it('CR input should be above 150', () => {
          cy.get('.collat-collat-perct input')
            .then((v) => Number(v.val()))
            .should('be.at.least', 150)
        })

        it('send tx', () => {
          cy.get('#remove-collat-submit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
        })

        it.skip('the inputs and the form should be reset and uodated', () => {
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#remove-collat-submit-tx-btn').should('be.disabled')
          cy.get('#user-eth-wallet-balance').then((bal) => {
            cy.get('#vault-collat-input-eth-alance').should('contain.text', Number(bal.text()).toFixed(4))
          })
        })

        it('check vault collat amount', () => {
          cy.get('#vault-collat-amount').wait(20000).should('contain.text', (8).toFixed(4))
        })

        it('check shorted debt balance after collateral added', () => {
          cy.get('#vault-shorted-debt-bal')
            .invoke('text')
            .then(parseFloat)
            .should('eq', Number(shortedDebtBeforeMint.toFixed(6)))
        })

        it('check lped debt balances after collateral added', () => {
          cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('equal', 0)
        })

        it('new liq price has updated', () => {
          cy.get('#debt-new-liqp .trade-info-item-value').should('contain.text', liqpAfterTrade)
        })

        it('new cr has updated', () => {
          cy.get('.debt-collat-perct input')
            .then((v) => v.val())
            .should('eq', crAfterTrade)
        })
      })
    })

    context(`close short position`, () => {
      before(() => {
        cy.visit('/')
        cy.get('#short-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })

      it('can close short position', () => {
        cy.get('close-short-type-select').wait(20000).should('contain.text', 'Full Close')
        cy.get('#close-short-osqth-input').should('not.equal', '0')

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
    })
  })
})
