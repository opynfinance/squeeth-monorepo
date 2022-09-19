import { init, track } from '@amplitude/analytics-browser'

const analyticsEnabled = !!process.env.NEXT_PUBLIC_AMPLITUDE_KEY

// Should be called once before calling track event
export const initializeAmplitude = () => {
  if (!process.env.NEXT_PUBLIC_AMPLITUDE_KEY) return

  init(process.env.NEXT_PUBLIC_AMPLITUDE_KEY, undefined, {
    trackingOptions: {
      deviceManufacturer: false,
      deviceModel: false,
      ipAddress: false,
      osName: true,
      osVersion: true,
      platform: true,
    },
    attribution: {
      trackNewCampaigns: true,
    },
  })
}

export const trackEvent = (eventName: EVENT_NAME, eventProps?: Record<string, unknown>) => {
  if (!analyticsEnabled) {
    console.log(`Analytics: ${eventName}`, JSON.stringify(eventProps))
    return
  }

  track(eventName, eventProps)
}

export enum EVENT_NAME {
  WALLET_CONNECTED = 'WALLET_CONNECTED',
  DEPOSIT_CRAB_CLICK = 'DEPOSIT_CRAB_CLICK',
  DEPOSIT_CRAB_SUCCESS = 'DEPOSIT_CRAB_SUCCESS',
  DEPOSIT_CRAB_FAILED = 'DEPOSIT_CRAB_FAILED',
  WITHDRAW_CRAB_CLICK = 'WITHDRAW_CRAB_CLICK',
  WITHDRAW_CRAB_SUCCESS = 'WITHDRAW_CRAB_SUCCESS',
  WITHDRAW_CRAB_FAILED = 'WITHDRAW_CRAB_FAILED',
}
