export default class Page {
  getTitle() {
    return cy.title()
  }

  getMetamaskWalletAddress() {
    return cy.fetchMetamaskWalletAddress()
  }

  acceptMetamaskAccessRequest() {
    cy.acceptMetamaskAccess()
  }

  confirmMetamaskTransaction() {
    // Currently without supplying a gas configuration results in failing transactions
    // Possibly caused by wrong default behaviour within Synpress
    cy.confirmMetamaskTransaction({ gasFee: 30, gasLimit: 5000000 })
  }

  confirmMetamaskPermissionToSpend() {
    cy.confirmMetamaskPermissionToSpend().then((approved) => {
      expect(approved).to.be.true
    })
  }
}
