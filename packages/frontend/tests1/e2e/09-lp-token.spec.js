/// <reference types="cypress" />
import TradePage from '../pages/trade'

const trade = new TradePage()

describe('lp nft as collateral txs', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit('/vault/251')
    })
    context('Connect metamask wallet', () => {
      it(`should login with success`, () => {
        trade.connectBrowserWallet()
        trade.acceptMetamaskAccessRequest()

        cy.get('#wallet-address').should(`contain.text`, '0x' || '.eth')
      })
    })

    context(`Approve and deposit lp nft`, () => {
      it('enter vault page, should have lp position and the link to vault', () => {
        cy.get('#lp-vault-link a').invoke('removeAttr', 'target').click()
      })

      it('should have lp debt before test', () => {
        cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('be.greaterThan', 0)
      })

      it('should have lp nft selector and lp nft id', () => {
        cy.get('#lp-id-select').click({ force: true })
        cy.get('#lp-id-option-none').click({ force: true })
        cy.get('#lp-id-select').should('contain.text', 'None')
        cy.get('#lp-id-option-0').click({ force: true })
        cy.get('#lp-id-select').should('not.contain.text', 'None')
      })

      it('approve lp nft as collateral', () => {
        cy.get('#lp-id-select').click({ force: true })
        cy.get('#lp-id-option-0').click({ force: true })
        cy.get('#approve-lp-nft-submit-tx-btn').should('not.be.disabled')
        cy.get('#approve-lp-nft-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#deposit-lp-nft-submit-tx-btn').should('be.visible')
        cy.get('#deposit-lp-nft-submit-tx-btn').should('not.be.disabled')
      })

      it('deposit lp nft as collateral', () => {
        cy.get('#lp-id-select').should('not.contain.text', 'None')
        cy.get('#deposit-lp-nft-submit-tx-btn').should('not.be.disabled')
        cy.get('#deposit-lp-nft-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('.deposited-lp-id').should('be.disabled')
        cy.get('#withdraw-lp-nft-submit-tx-btn').should('be.visible')
        cy.get('#withdraw-lp-nft-submit-tx-btn').should('not.be.disabled')
      })
    })

    context('Mint', () => {
      it(`can mint`, () => {
        cy.get('#debt-amount-input').clear().type('1.', { delay: 200, force: true }).should('have.value', '1.0')
        cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
        cy.get('#mint-submit-tx-btn').should('not.be.disabled')
        cy.get('#mint-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#debt-amount-input').should('have.value', '0')
        cy.get('#mint-submit-tx-btn').should('be.disabled')
      })
    })
    context('Burn', () => {
      it(`can burn `, () => {
        cy.get('#debt-amount-input').clear().type('-1.1', { delay: 200, force: true }).should('have.value', '-1.1')
        cy.get('.debt-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
        cy.get('#burn-submit-tx-btn').should('not.be.disabled')
        cy.get('#burn-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#debt-amount-input').should('have.value', '0')
        cy.get('#burn-submit-tx-btn').should('be.disabled')
      })
    })
    context('Add collat', () => {
      it(`can add collat `, () => {
        cy.get('#collat-amount-input').clear().type('1.', { delay: 200, force: true }).should('have.value', '1.0')
        cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
        cy.get('#add-collat-submit-tx-btn').should('not.be.disabled')
        cy.get('#add-collat-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#collat-amount-input').should('have.value', '0')
        cy.get('#add-collat-submit-tx-btn').should('be.disabled')
      })
    })
    context('Remove Collat', () => {
      it(`can remove collat `, () => {
        cy.get('#collat-amount-input').clear().type('-1.1', { delay: 200, force: true }).should('have.value', '-1.1')
        cy.get('.collat-collat-perct').invoke('text').then(parseFloat).should('be.at.least', 150)
        cy.get('#remove-collat-submit-tx-btn').should('not.be.disabled')
        cy.get('#remove-collat-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#collat-amount-input').should('have.value', '0')
        cy.get('#remove-collat-submit-tx-btn').should('be.disabled')
      })
    })

    context('Withdraw lp nft', () => {
      it('can withdraw lp nft', () => {
        cy.get('#withdraw-lp-nft-submit-tx-btn').should('be.disabled')
        cy.get('#withdraw-lp-nft-submit-tx-btn').click({ force: true })
        trade.confirmMetamaskTransaction()
        trade.waitForTransactionSuccess()
        cy.get('#lp-id-select').should('contain.text', 'None')
      })
      // issue 233
      it.skip('check lp position', () => {
        cy.get('#vault-lped-debt-bal').invoke('text').then(parseFloat).should('not.equal', 0)
      })
    })
  })
})
