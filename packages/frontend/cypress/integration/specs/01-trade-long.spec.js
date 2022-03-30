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
      //to make sure the cards are function independently after switching
      cy.get('#open-long-eth-input').type('2', { delay: 200 })

      cy.get('#long-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
      cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
      cy.get('#close-long-eth-input').should('have.value', '0')
      cy.get('#close-long-osqth-input').should('have.value', '0')
      cy.get('#close-long-eth-input').type('2', { delay: 200 })

      cy.get('#short-card-btn').click({ force: true })
      cy.get('#open-btn').click({ force: true })
      cy.get('#open-short-header-box').should('contain.text', 'Mint & sell squeeth for premium')
      cy.get('#open-short-eth-input').should('have.value', '0')
      cy.get('#open-short-trade-details .trade-details-amount').should('contain.text', '0')
      cy.get('#open-short-eth-input').type('2', { delay: 200 })

      cy.get('#short-card-btn').click({ force: true })
      cy.get('#close-btn').click({ force: true })
      cy.get('#close-short-header-box').should('contain.text', 'Buy back oSQTH & close position')
      cy.get('#close-short-osqth-input').should('have.value', '0')
      cy.get('#close-short-trade-details .trade-details-amount').should('contain.text', '0')
    })

    context(`open long position`, () => {
      before(() => {
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#open-btn').click({ force: true })
      })
      context(`when wallet has no eth balance`, () => {
        it('enter an amount into inputs will get error', () => {
          cy.get('#user-eth-wallet-balance').then((bal) => {
            if (Number(bal.text()) == 0) {
              cy.get('#open-long-eth-input').clear().type('1.', { delay: 200 })
              cy.get('#open-long-eth-input-box').should('contain.text', 'Insufficient ETH balance')
            }
          })
        })
      })
      context(`when wallet has eth balance`, () => {
        it('eth balance from wallet should be the same as eth input box', () => {
          cy.get('#user-eth-wallet-balance').then((bal) => {
            cy.get('#open-long-eth-before-trade-balance').should('contain.text', Number(bal.text()).toFixed(2))
          })
        })

        it('inputs should be zero by default and tx button is disabled', () => {
          cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
          cy.get('#open-long-eth-input').should('have.value', '0')
          cy.get('#open-long-osqth-input').should('have.value', '0')
          cy.get('#open-long-sumbit-tx-btn').should('be.disabled')
        })

        it('zero input amount', () => {
          cy.get('#open-long-eth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
          cy.get('#open-long-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        })

        it('invalid input amount', () => {
          cy.get('#open-long-eth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
          cy.get('#open-long-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
        })

        it('can enter an amount into eth input, before & post trade amount match on position card and osqth input', () => {
          // cy.get('#open-long-eth-input').clear().type('1', { force: true, delay: 200 }).should('have.value', '1')
          cy.get('#open-long-eth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')
          cy.get('#open-long-eth-before-trade-balance').then((bal) => {
            cy.get('#open-long-eth-post-trade-balance').should('contain.text', (Number(bal.text()) - 1).toFixed(2))
          })

          cy.get('#open-long-osqth-input').should('not.equal', '0')
          cy.get('#open-long-osqth-input').then((val) => {
            cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
              cy.get('#open-long-osqth-post-trade-balance').should(
                'contain.text',
                new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(2),
              )
            })
            cy.get('#position-card-before-trade-balance').then((bal) => {
              cy.get('#position-card-post-trade-balance').should(
                'contain.text',
                new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(2),
              )
            })
          })
        })

        it('can enter an amount into osqth input, before & post trade amount match on position card and eth input', () => {
          // cy.get('#open-long-osqth-input').clear().type('1.', { delay: 200 }).should('have.value', '1.0')
          cy.get('#open-long-osqth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')

          cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
            cy.get('#open-long-osqth-post-trade-balance').should('contain.text', (Number(bal.text()) + 1.1).toFixed(2))
          })

          cy.get('#open-long-eth-input').should('not.equal', '0')
          cy.get('#open-long-eth-input').then((val) => {
            cy.get('#open-long-eth-before-trade-balance').then((bal) => {
              cy.get('#open-long-eth-post-trade-balance').should(
                'contain.text',
                new BigNumber(bal.text()).minus(val.val().toString()).toFixed(2),
              )
            })
          })
          cy.get('#open-long-osqth-input').then((val) => {
            cy.get('#position-card-before-trade-balance').then((bal) => {
              cy.get('#position-card-post-trade-balance').should(
                'contain.text',
                new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(2),
              )
            })
          })
        })

        it('can use max button for open long eth input', () => {
          cy.get('#open-long-eth-input-action').click()
          cy.get('#open-long-osqth-input').should('not.equal', '0')

          cy.get('#open-long-osqth-post-trade-balance').should('not.contain.text', (0).toFixed(6))
          cy.get('#position-card-post-trade-balance').should('not.contain.text', '0')
        })

        it('can open long position for osqth', () => {
          cy.get('#open-long-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
          cy.get('#open-long-osqth-input').then((v) => {
            cy.get('#open-long-osqth-before-trade-balance').then((bal) => {
              const inputSqth = new BigNumber(v.val().toString()).toFixed(6)
              cy.get('#open-long-sumbit-tx-btn').should('contain.text', 'Buy')
              cy.get('#open-long-sumbit-tx-btn').click({ force: true })
              trade.confirmMetamaskTransaction()
              trade.waitForTransactionSuccess()

              cy.get('#open-long-card').should('contain.text', 'Close').should('contain.text', 'Bought')
              cy.get('#position-card-before-trade-balance').should(
                'contain.text',
                (Number(inputSqth) + Number(bal.text())).toFixed(2),
                { delay: 2000 },
              )
              cy.get('#conf-msg').should('contain.text', inputSqth)
            })
          })
          cy.get('#open-long-close-btn').click()
          cy.get('#open-long-header-box').should('contain.text', 'Pay ETH to buy squeeth ERC20')
          cy.get('#open-long-eth-input').should('have.value', '0')
          cy.get('#open-long-osqth-input').should('have.value', '0')
          cy.get('#open-long-sumbit-tx-btn').should('be.disabled')
        })
      })
    })
    context(`close long position`, () => {
      before(() => {
        cy.get('#long-card-btn').click({ force: true })
        cy.get('#close-btn').click({ force: true })
      })
      it('inputs should be zero by default and tx button is disabled', () => {
        cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
        cy.get('#close-long-eth-input').should('have.value', '0')
        cy.get('#close-long-osqth-input').should('have.value', '0')
        cy.get('#close-long-sumbit-tx-btn').should('be.disabled')
      })
      context(`when wallet has no osqth balance`, () => {
        it('enter an amount into inputs will get error', () => {
          cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
            if (Number(bal.text()) == 0) {
              cy.get('#close-long-osqth-input').clear().type('1', { delay: 200 })
              cy.get('#close-long-osqth-input-box').should('contain.text', 'Insufficient oSQTH balance')
            }
          })
        })
      })
      context(`when wallet has osqth balance`, () => {
        it('zero input amount', () => {
          cy.get('#close-long-eth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
          cy.get('#close-long-osqth-input').clear().type('0', { delay: 200 }).should('have.value', '0')
        })

        it('invalid input amount', () => {
          cy.get('#close-long-eth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
          cy.get('#close-long-osqth-input').clear().type('\\', { delay: 200 }).should('have.value', '0')
        })

        it('can enter an amount into osqth input, before & post trade amount match on position card and eth input', () => {
          // cy.get('#open-long-eth-input').clear().type('1', { force: true, delay: 200 }).should('have.value', '1')
          cy.get('#close-long-osqth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')
          cy.get('#open-long-osqth-before-trade-balance').then((val) => {
            cy.get('#open-long-osqth-post-trade-balance').should('contain.text', (Number(val.text()) - 1).toFixed(2))
            cy.get('#position-card-before-trade-balance').then((val) => {
              cy.get('#position-card-post-trade-balance').should('contain.text', (Number(val.text()) - 1).toFixed(2))
            })
          })

          cy.get('#close-long-eth-input').should('not.equal', '0')
          cy.get('#close-long-eth-input').then((val) => {
            cy.get('#close-long-eth-before-trade-balance').then((bal) => {
              cy.get('#close-long-eth-post-trade-balance').should(
                'contain.text',
                new BigNumber(val.val().toString()).plus(Number(bal.text())).toFixed(2),
              )
            })
          })
        })

        it('can enter an amount into eth input, before & post trade amount match on position card and osqth input', () => {
          // cy.get('#open-long-osqth-input').clear().type('1.', { delay: 200 }).should('have.value', '1.0')
          cy.get('#close-long-eth-input').clear().type('1.', { force: true, delay: 200 }).should('have.value', '1.0')

          cy.get('#close-long-eth-before-trade-balance').then((bal) => {
            cy.get('#close-long-eth-post-trade-balance').should('contain.text', (Number(bal.text()) + 1.1).toFixed(2))
          })

          cy.get('#close-long-osqth-input').should('not.equal', '0')
          cy.get('#close-long-osqth-input').then((val) => {
            cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
              cy.get('#close-long-osqth-post-trade-balance').should(
                'contain.text',
                new BigNumber(bal.text()).minus(val.val().toString()).toFixed(2),
              )
            })
            cy.get('#position-card-before-trade-balance').then((bal) => {
              cy.get('#position-card-post-trade-balance').should(
                'contain.text',
                new BigNumber(bal.text()).minus(val.val().toString()).toFixed(2),
              )
            })
          })
        })

        it('can use max button for close long osqth input', () => {
          cy.get('#close-long-osqth-input-action').click()
          cy.get('#close-long-eth-input').should('not.equal', '0')

          cy.get('#close-long-osqth-input').then((val) => {
            const osqthInput = new BigNumber(val.val().toString()).toFixed(6)
            cy.get('#close-long-osqth-before-trade-balance').should('contain.text', osqthInput)
            cy.get('#position-card-before-trade-balance').should('contain.text', osqthInput)
          })

          cy.get('#close-long-osqth-post-trade-balance').should('contain.text', (0).toFixed(6))
          cy.get('#position-card-post-trade-balance').should('contain.text', '0')
        })

        it('can close long position partially for eth', () => {
          cy.get('#close-long-eth-input').clear().type('0.1', { force: true, delay: 200 }).should('have.value', '0.1')
          cy.get('#close-long-osqth-input').then((v) => {
            cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
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
              cy.get('#position-card-before-trade-balance').should(
                'contain.text',
                (Number(bal.text()) - Number(inputSqth)).toFixed(2),
                { delay: 2000 },
              )
              cy.get('#conf-msg').should('contain.text', inputSqth)
            })
          })
          cy.get('#close-long-close-btn').click()
          cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
          cy.get('#close-long-eth-input').should('have.value', '0')
          cy.get('#close-long-osqth-input').should('have.value', '0')
          cy.get('#close-long-sumbit-tx-btn').should('be.disabled')
        })

        it(`close long position fully with max button`, () => {
          cy.get('#close-long-eth-input-action').click()
          cy.get('#close-long-osqth-input').should('not.equal', '0')

          cy.get('#close-long-osqth-input').then((v) => {
            cy.get('#close-long-osqth-before-trade-balance').then((bal) => {
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
              cy.get('#position-card-before-trade-balance').should(
                'contain.text',
                (Number(bal.text()) - Number(inputSqth)).toFixed(2),
                { delay: 2000 },
              )
              cy.get('#conf-msg').should('contain.text', inputSqth)
            })
          })
          cy.get('#close-long-close-btn').click()
          cy.get('#close-long-header-box').should('contain.text', 'Sell squeeth ERC20 to get ETH')
          cy.get('#close-long-eth-input').should('have.value', '0')
          cy.get('#close-long-osqth-input').should('have.value', '0')
          cy.get('#close-long-sumbit-tx-btn').should('be.disabled')
          cy.get('#close-long-osqth-before-trade-balance').should('contain.text', (0).toFixed(6))
          cy.get('#position-card-before-trade-balance').should('contain.text', '0')
        })
      })
    })
  })
})
