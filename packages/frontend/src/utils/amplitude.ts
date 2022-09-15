import { init, track } from '@amplitude/analytics-browser'

const analyticsEnabled = !!process.env.NEXT_PUBLIC_AMPLITUDE_KEY

export const initializeAmplitude = () => {
  if (!process.env.NEXT_PUBLIC_AMPLITUDE_KEY) return

  init(process.env.NEXT_PUBLIC_AMPLITUDE_KEY, undefined, {
    trackingOptions: {
      deviceManufacturer: false,
      deviceModel: false,
      ipAddress: false,
      osName: true,
      osVersion: false,
      platform: true,
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
}
