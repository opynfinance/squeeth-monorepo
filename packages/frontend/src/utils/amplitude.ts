import { init, track, Types } from '@amplitude/analytics-browser'
import { getCookieName, CookieStorage } from '@amplitude/analytics-client-common'
import { canStoreCookies } from './cookies'

const analyticsEnabled = !!process.env.NEXT_PUBLIC_AMPLITUDE_KEY && !!canStoreCookies()

// Should be called once before calling track event
export const initializeAmplitude = () => {
  if (!process.env.NEXT_PUBLIC_AMPLITUDE_KEY || !canStoreCookies()) return

  isOptedOut().then((optOut) => {
    // console.log('Opted out', optOut)
    if (!process.env.NEXT_PUBLIC_AMPLITUDE_KEY) return

    init(process.env.NEXT_PUBLIC_AMPLITUDE_KEY, undefined, {
      serverZone: Types.ServerZone.EU,
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
      optOut,
    })
  })
}

export const trackEvent = (eventName: string, eventProps?: Record<string, unknown>) => {
  if (!analyticsEnabled) {
    //console.log(`Analytics: ${eventName}`, JSON.stringify(eventProps))
    return
  }

  track(eventName, eventProps)
}

export enum BULL_EVENTS {
  DEPOSIT_BULL_AMOUNT_ENTERED = 'DEPOSIT_BULL_AMOUNT_ENTERED',
  DEPOSIT_BULL_CLICK = 'DEPOSIT_BULL_CLICK',
  DEPOSIT_BULL_SUCCESS = 'DEPOSIT_BULL_SUCCESS',
  DEPOSIT_BULL_FAILED = 'DEPOSIT_BULL_FAILED',
  DEPOSIT_BULL_REVERT = 'DEPOSIT_BULL_REVERT',
  WITHDRAW_BULL_AMOUNT_ENTERED = 'WITHDRAW_BULL_AMOUNT_ENTERED',
  WITHDRAW_BULL_CLICK = 'WITHDRAW_BULL_CLICK',
  WITHDRAW_BULL_SUCCESS = 'WITHDRAW_BULL_SUCCESS',
  WITHDRAW_BULL_FAILED = 'WITHDRAW_BULL_FAILED',
  WITHDRAW_BULL_REVERT = 'WITHDRAW_BULL_REVERT',
  DEPOSIT_BULL_WRONG_GAS = 'DEPOSIT_BULL_WRONG_GAS',
  WITHDRAW_BULL_WRONG_GAS = 'WITHDRAW_BULL_WRONG_GAS',
}

export enum WALLET_EVENTS {
  WALLET_CONNECTED = 'WALLET_CONNECTED',
}

export enum CRAB_EVENTS {
  DEPOSIT_CRAB_AMOUNT_ENTERED = 'DEPOSIT_CRAB_AMOUNT_ENTERED',
  DEPOSIT_CRAB_CLICK = 'DEPOSIT_CRAB_CLICK',
  DEPOSIT_CRAB_SUCCESS = 'DEPOSIT_CRAB_SUCCESS',
  DEPOSIT_CRAB_REVERT = 'DEPOSIT_CRAB_REVERT',
  DEPOSIT_CRAB_FAILED = 'DEPOSIT_CRAB_FAILED',
  DEPOSIT_CRAB_USDC_CLICK = 'DEPOSIT_CRAB_USDC_CLICK',
  DEPOSIT_CRAB_USDC_SUCCESS = 'DEPOSIT_CRAB_USDC_SUCCESS',
  DEPOSIT_CRAB_USDC_REVERT = 'DEPOSIT_CRAB_USDC_REVERT',
  DEPOSIT_CRAB_USDC_FAILED = 'DEPOSIT_CRAB_USDC_FAILED',
  WITHDRAW_CRAB_AMOUNT_ENTERED = 'WITHDRAW_CRAB_AMOUNT_ENTERED',
  WITHDRAW_CRAB_CLICK = 'WITHDRAW_CRAB_CLICK',
  WITHDRAW_CRAB_SUCCESS = 'WITHDRAW_CRAB_SUCCESS',
  WITHDRAW_CRAB_REVERT = 'WITHDRAW_CRAB_REVERT',
  WITHDRAW_CRAB_FAILED = 'WITHDRAW_CRAB_FAILED',
  DEPOSIT_STN_CRAB_USDC_CLICK = 'DEPOSIT_STN_CRAB_USDC_CLICK',
  DEPOSIT_STN_CRAB_USDC_SUCCESS = 'DEPOSIT_STN_CRAB_USDC_SUCCESS',
  DEPOSIT_STN_CRAB_USDC_REVERT = 'DEPOSIT_STN_CRAB_USDC_REVERT',
  DEPOSIT_STN_CRAB_USDC_FAILED = 'DEPOSIT_STN_CRAB_USDC_FAILED',
  WITHDRAW_STN_CRAB_USDC_CLICK = 'WITHDRAW_STN_CRAB_USDC_CLICK',
  WITHDRAW_STN_CRAB_USDC_SUCCESS = 'WITHDRAW_STN_CRAB_USDC_SUCCESS',
  WITHDRAW_STN_CRAB_USDC_REVERT = 'WITHDRAW_STN_CRAB_USDC_REVERT',
  WITHDRAW_STN_CRAB_USDC_FAILED = 'WITHDRAW_STN_CRAB_USDC_FAILED',
  USER_FORCE_INSTANT_DEP_CRAB = 'USER_FORCE_INSTANT_DEP_CRAB',
  USER_FORCE_INSTANT_WIT_CRAB = 'USER_FORCE_INSTANT_WIT_CRAB',
}

export const isOptedOut = async () => {
  if (!process.env.NEXT_PUBLIC_AMPLITUDE_KEY || typeof window === 'undefined') return false

  try {
    const cookieName = getCookieName(process.env.NEXT_PUBLIC_AMPLITUDE_KEY)
    const data = await new CookieStorage<{ optOut: boolean }>().get(cookieName)

    return !!data?.optOut
  } catch (e) {
    console.log(e)
  }

  return false
}
