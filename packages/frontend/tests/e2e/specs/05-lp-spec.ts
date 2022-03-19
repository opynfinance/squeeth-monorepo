/* eslint-disable ui-testing/missing-assertion-in-test */
import TradePage from '../pages/trade'

const trade = new TradePage()

//seems not supported by sypress, cuz either external link or embed window require a wallet connection as well
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
      trade.connectBrowserWallet()
      trade.acceptMetamaskAccessRequest()
    })
  })

  context(`LP`, () => {
    it('LP squeeth', () => {
      cy.get('.button').contains('(Max)').click({ force: true })
      cy.get('.button').contains('Approve').click({ force: true })
      cy.get('.button').contains('Preview').click({ force: true })
      cy.get('.button').contains('Add').click({ force: true })
      trade.confirmMetamaskTransaction()
      trade.waitForTransactionSuccess()
    })
  })
})
