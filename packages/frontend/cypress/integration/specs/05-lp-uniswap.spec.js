/// <reference types="cypress" />

const trade = new TradePage()
import TradePage from '../pages/trade'

//please run 04-buy or 04-mint first
describe('LP squeeth on uniswap', () => {
  context('Before tests', () => {
    it(`Before tests`, () => {
      cy.disconnectMetamaskWalletFromAllDapps()
      cy.visit({
        url: 'https://squeeth-uniswap.netlify.app/#/add/ETH/0xa4222f78d23593e82Aa74742d25D06720DCa4ab7/3000',
      })
    })
  })

  context('Connect metamask wallet', () => {
    it(`should login with success`, () => {
      cy.get('#connect-wallet').click()
      cy.get('#connect-METAMASK').click()
      trade.acceptMetamaskAccessRequest()
    })
  })

  context(`LP`, () => {
    it('LP squeeth', () => {
      cy.get('button').contains('(Max)').click({ force: true })
      cy.get('button').contains('Approve oSQTH').click({ force: true })
      cy.get('button').contains('Preview').click({ force: true })
      cy.get('button').contains('Add oSQTH').click({ force: true })
      // trade.confirmMetamaskTransaction()
      // trade.waitForTransactionSuccess()
    })
  })
})
