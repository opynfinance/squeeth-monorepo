import Page from './page'
export default class Notifications extends Page {
  getTransactionSuccessNotification() {
    return cy.contains('has succeeded', { timeout: 600000 }).should(`exist`)
  }
  getTransactionSuccessNotificationLink() {
    return cy.get('.bn-notify-notification-success a', { timeout: 60000 })
  }
}
