/// <reference types="cypress" />
import TradePage from '../pages/trade'

const trade = new TradePage()

describe('Open short position and then mint debt, burn debt, add collat, remove collat on vault page', () => {
  context('Open short position', () => {
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
        cy.get('#open-short-eth-input').clear().type('8.', { force: true, delay: 200 }).should('have.value', '8.0')

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
      })
    })

    context('Check the vault', () => {
      // before(() => {
      //   //not opening new tab
      //   cy.get('#pos-card-manage-vault-link a').invoke('removeAttr', 'target').click()
      // })
      it(`Before tests`, () => {
        //not opening new tab
        cy.get('#pos-card-manage-vault-link a').invoke('removeAttr', 'target').click()
      })
      context(`before tx checks`, () => {
        it('total debt balance & collateral should not be zero', () => {
          cy.get('#vault-total-debt-bal').invoke('text').should('not.equal', '0')
          cy.get('#vault-collat-amount').invoke('text').should('not.equal', '0')
        })
        it('there should be enought eth to test', () => {
          cy.get('#user-eth-wallet-balance').invoke('text').then(parseFloat).should('be.greaterThan', 5)
        })
        it(`input should be zero and button should be disabled by default`, () => {
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#mint-sumbit-tx-btn').should('be.disabled')
          cy.get('#burn-sumbit-tx-btn').should('be.disabled')
          cy.get('#add-collat-tx-btn').should('be.disabled')
          cy.get('#remove-collat-tx-btn').should('be.disabled')
        })
        it(`balance of osqth in adjust debt box should be equal to minted osqth`, () => {
          cy.get('#vault-debt-input-osqth-balance').then((bal) => {
            cy.get('#vault-minted-debt-bal').should('contain.text', Number(bal.text()).toFixed(2))
          })
        })
        it(`eth balance from wallet should be the same as balance of eth input box`, () => {
          cy.get('#user-eth-wallet-balance').then((bal) => {
            cy.get('#vault-collat-input-eth-balance').should('contain.text', Number(bal.text()).toFixed(2))
          })
        })
      })
      context('Mint', () => {
        it(`can mint with manual input`, () => {
          cy.get('#debt-amount-input').clear().type('1.1', { delay: 200, force: true }).should('have.value', '1.1')
          cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#mint-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#mint-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#mint-sumbit-tx-btn').should('be.disabled')
          // cy.get('#vault-minted-debt-bal').then((inputBal) => {
          //   cy.get('#vault-minted-debt-bal').then((bal) => {
          //     cy.get('#vault-total-debt-bal').then((val) => {
          //       cy.get('#vault-debt-input-osqth-balance').then((v) => {
          //         const mintedBalBeforeTrade = bal.text()
          //         const totalBalBeforeTrade = val.text()
          //         const inputBalBeforeTrade = v.text()
          //         cy.get('#mint-sumbit-tx-btn').click({ force: true })
          //         trade.confirmMetamaskTransaction()
          //         trade.waitForTransactionSuccess()
          //         cy.get('#vault-minted-debt-bal').should(
          //           'contain.text',
          //           (Number(mintedBalBeforeTrade) + Number(inputBal)).toFixed(6),
          //           { delay: 2000 },
          //         )
          //         cy.get('#vault-total-debt-bal').should(
          //           'contain.text',
          //           (Number(totalBalBeforeTrade) + Number(inputBal)).toFixed(6),
          //           { delay: 2000 },
          //         )

          //         cy.get('#vault-debt-input-osqth-balance').should(
          //           'contain.text',
          //           (Number(inputBalBeforeTrade) + Number(inputBal)).toFixed(6),
          //           { delay: 2000 },
          //         )
          //       })
          //     })
          //   })
          // })
        })
        it(`can mint with max button`, () => {
          cy.get('#debt-amount-input').clear().type('1.1', { delay: 200, force: true }).should('have.value', '1.1')
          cy.get('#debt-max-btn').click({ force: true })
          cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#mint-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#mint-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#mint-sumbit-tx-btn').should('be.disabled')
        })
      })
      context('Burn', () => {
        it(`can burn with manual input`, () => {
          cy.get('#debt-amount-input').clear().type('-1.1', { delay: 200, force: true }).should('have.value', '-1.1')
          cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#burn-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#burn-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#burn-sumbit-tx-btn').should('be.disabled')
        })
        it(`can burn with max button`, () => {
          cy.get('#debt-amount-input').clear().type('-1.1', { delay: 200, force: true }).should('have.value', '-1.1')
          cy.get('#debt-max-btn').click({ force: true })
          cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#burn-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#burn-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#debt-amount-input').should('have.value', '0')
          cy.get('#burn-sumbit-tx-btn').should('be.disabled')
        })
      })
      context('Add collat', () => {
        it(`can add collat with manual input`, () => {
          cy.get('#collat-amount-input').clear().type('1.1', { delay: 200, force: true }).should('have.value', '1.1')
          cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#add-collat-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#add-collat-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#add-collat-sumbit-tx-btn').should('be.disabled')
        })
        it(`can add collat with max button`, () => {
          cy.get('#collat-amount-input').clear().type('1.1', { delay: 200, force: true }).should('have.value', '1.1')
          cy.get('#collat-max-btn').click({ force: true })
          cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#add-collat-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#add-collat-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#add-collat-sumbit-tx-btn').should('be.disabled')
        })
      })
      context('Remove Collat', () => {
        it(`can remove collat with manual input`, () => {
          cy.get('#collat-amount-input').clear().type('-1.1', { delay: 200, force: true }).should('have.value', '-1.1')
          cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#remove-collat-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#remove-collat-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#remove-collat-sumbit-tx-btn').should('be.disabled')
        })
        it(`can remove collat with max button`, () => {
          cy.get('#collat-max-btn').click({ force: true })
          cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
          cy.get('#remove-collat-sumbit-tx-btn').should('not.be.disabled')
          cy.get('#remove-collat-sumbit-tx-btn').click({ force: true })
          trade.confirmMetamaskTransaction()
          trade.waitForTransactionSuccess()
          cy.get('#collat-amount-input').should('have.value', '0')
          cy.get('#remove-collat-sumbit-tx-btn').should('be.disabled')
        })
      })

      context(`close short position`, () => {
        before(() => {
          cy.get('#short-card-btn').click({ force: true })
          cy.get('#close-btn').click({ force: true })
        })
        it('can close short position', () => {
          cy.get('close-short-type-select').select('Fully Close')
          cy.get('close-short-type-select').should('contain.text', 'Fully Close')

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
        })
      })

      // context('Withdraw Collat when there is extra collat and no short position', () => {})
    })
  })
})
