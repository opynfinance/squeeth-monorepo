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
      serverUrl: '/api/amplitude',
    })
  })
}

export const trackEvent = (eventName: string, eventProps?: Record<string, unknown>) => {
  if (!analyticsEnabled) {
    console.log(`Analytics: ${eventName}`, JSON.stringify(eventProps))
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
  APPROVE_WITHDRAW_BULL = 'APPROVE_WITHDRAW_BULL',
  DEPOSIT_BULL_WRONG_GAS = 'DEPOSIT_BULL_WRONG_GAS',
  WITHDRAW_BULL_WRONG_GAS = 'WITHDRAW_BULL_WRONG_GAS',
  DEPOSIT_BULL_SET_AMOUNT_MAX = 'DEPOSIT_BULL_SET_AMOUNT_MAX',
  WITHDRAW_BULL_SET_AMOUNT_MAX = 'WITHDRAW_BULL_SET_AMOUNT_MAX',
  DEPOSIT_BULL_CHANGE_SLIPPAGE = 'DEPOSIT_BULL_CHANGE_SLIPPAGE',
  WITHDRAW_BULL_CHANGE_SLIPPAGE = 'WITHDRAW_BULL_CHANGE_SLIPPAGE',
}

export enum WALLET_EVENTS {
  WALLET_CONNECTED = 'WALLET_CONNECTED',
}

export enum SITE_EVENTS {
  RELOAD_SITE = 'RELOAD_SITE',
  NAV_FAQ = 'NAV_FAQ',
  NAV_AUCTION = 'NAV_AUCTION',
  CLICK_DISCORD = 'CLICK_DISCORD',
  CLICK_DOCS = 'CLICK_DOCS',
  CLICK_TERMS_OF_SERVICE = 'CLICK_TERMS_OF_SERVICE',
  CLICK_PRIVACY_POLICY = 'CLICK_PRIVACY_POLICY',
  TOGGLE_COOKIE_CONSENT = 'TOGGLE_COOKIE_CONSENT',
  CLICK_LEARN_MORE_CRAB = 'CLICK_LEARN_MORE_CRAB',
  CLICK_LEARN_MORE_BULL = 'CLICK_LEARN_MORE_BULL',
  SEE_ADVANCED_METRICS_CRAB = 'SEE_ADVANCED_METRICS_CRAB',
  SEE_ADVANCED_METRICS_BULL = 'SEE_ADVANCED_METRICS_BULL',
  SUBGRAPH_QUERY_LOADED = 'SUBGRAPH_QUERY_LOADED',
  SHOW_ERROR_FEEDBACK_POPUP = 'SHOW_ERROR_FEEDBACK_POPUP',
  CLICK_ERROR_FEEDBACK_ACTION = 'CLICK_ERROR_FEEDBACK_ACTION',
  CLICK_SHARE_PNL = 'CLICK_SHARE_PNL',
}

export enum LANDING_EVENTS {
  LANDING_VISIT = 'LANDING_VISIT',
  LANDING_VISIT_MOBILE = 'LANDING_VISIT_MOBILE',
  LANDING_VISIT_DESKTOP = 'LANDING_VISIT_DESKTOP',
  NAV_DEVELOPERS = 'NAV_DEVELOPERS',
  NAV_BLOG = 'NAV_BLOG',
  NAV_SECURITY = 'NAV_SECURITY',
  NAV_SOCIAL_TWITTER = 'NAV_SOCIAL_TWITTER',
  NAV_SOCIAL_GITHUB = 'NAV_SOCIAL_GITHUB',
  NAV_SOCIAL_DISCORD = 'NAV_SOCIAL_DISCORD',
  NAV_SOCIAL_MEDIUM = 'NAV_SOCIAL_MEDIUM',
  NAV_START_EARNING = 'NAV_START_EARNING',
  NAV_HERO_TOP_START_EARNING = 'NAV_HERO_START_EARNING',
  NAV_HERO_SQUEETH = 'NAV_HERO_SQUEETH',
  NAV_HERO_DOWN_START_EARNING = 'NAV_HERO_DOWN_START_EARNING',
  NAV_HERO_AUCTION = 'NAV_HERO_AUCTION',
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
  WITHDRAW_CRAB_USDC_CLICK = 'WITHDRAW_CRAB_USDC_CLICK',
  WITHDRAW_CRAB_USDC_SUCCESS = 'WITHDRAW_CRAB_USDC_SUCCESS',
  WITHDRAW_CRAB_USDC_REVERT = 'WITHDRAW_CRAB_USDC_REVERT',
  WITHDRAW_CRAB_USDC_FAILED = 'WITHDRAW_CRAB_USDC_FAILED',
  WITHDRAW_CRAB_AMOUNT_ENTERED = 'WITHDRAW_CRAB_AMOUNT_ENTERED',
  WITHDRAW_CRAB_CLICK = 'WITHDRAW_CRAB_CLICK',
  WITHDRAW_CRAB_SUCCESS = 'WITHDRAW_CRAB_SUCCESS',
  WITHDRAW_CRAB_REVERT = 'WITHDRAW_CRAB_REVERT',
  WITHDRAW_CRAB_FAILED = 'WITHDRAW_CRAB_FAILED',
  DEPOSIT_STN_CRAB_USDC_CLICK = 'DEPOSIT_STN_CRAB_USDC_CLICK',
  DEPOSIT_STN_CRAB_USDC_SUCCESS = 'DEPOSIT_STN_CRAB_USDC_SUCCESS',
  DEPOSIT_STN_CRAB_USDC_REVERT = 'DEPOSIT_STN_CRAB_USDC_REVERT',
  DEPOSIT_STN_CRAB_USDC_FAILED = 'DEPOSIT_STN_CRAB_USDC_FAILED',
  CANCEL_DEPOSIT_STN_CRAB_USDC_CLICK = 'CANCEL_DEPOSIT_STN_CRAB_USDC_CLICK',
  CANCEL_DEPOSIT_STN_CRAB_USDC_SUCCESS = 'CANCEL_DEPOSIT_STN_CRAB_USDC_SUCCESS',
  CANCEL_DEPOSIT_STN_CRAB_USDC_REJECT = 'CANCEL_DEPOSIT_STN_CRAB_USDC_REJECT',
  CANCEL_DEPOSIT_STN_CRAB_USDC_FAILED = 'CANCEL_DEPOSIT_STN_CRAB_USDC_FAILED',
  WITHDRAW_STN_CRAB_USDC_CLICK = 'WITHDRAW_STN_CRAB_USDC_CLICK',
  WITHDRAW_STN_CRAB_USDC_SUCCESS = 'WITHDRAW_STN_CRAB_USDC_SUCCESS',
  WITHDRAW_STN_CRAB_USDC_REVERT = 'WITHDRAW_STN_CRAB_USDC_REVERT',
  WITHDRAW_STN_CRAB_USDC_FAILED = 'WITHDRAW_STN_CRAB_USDC_FAILED',
  CANCEL_WITHDRAW_STN_CRAB_USDC_CLICK = 'CANCEL_WITHDRAW_STN_CRAB_USDC_CLICK',
  CANCEL_WITHDRAW_STN_CRAB_USDC_SUCCESS = 'CANCEL_WITHDRAW_STN_CRAB_USDC_SUCCESS',
  CANCEL_WITHDRAW_STN_CRAB_USDC_REJECT = 'CANCEL_WITHDRAW_STN_CRAB_USDC_REJECT',
  CANCEL_WITHDRAW_STN_CRAB_USDC_FAILED = 'CANCEL_WITHDRAW_STN_CRAB_USDC_FAILED',
  USER_FORCE_INSTANT_DEP_CRAB = 'USER_FORCE_INSTANT_DEP_CRAB',
  USER_FORCE_INSTANT_WIT_CRAB = 'USER_FORCE_INSTANT_WIT_CRAB',
  APPROVE_DEPOSIT_CRAB_USDC = 'APPROVE_DEPOSIT_CRAB_USDC',
  APPROVE_DEPOSIT_STN_CRAB_USDC = 'APPROVE_DEPOSIT_STN_CRAB_USDC',
  APPROVE_WITHDRAW_CRAB_USDC = 'APPROVE_WITHDRAW_CRAB_USDC',
  APPROVE_WITHDRAW_STN_CRAB_USDC = 'APPROVE_WITHDRAW_STN_CRAB_USDC',
  DEPOSIT_CRAB_WRONG_GAS = 'DEPOSIT_CRAB_WRONG_GAS',
  WITHDRAW_CRAB_WRONG_GAS = 'WITHDRAW_CRAB_WRONG_GAS',
  DEPOSIT_CRAB_SET_AMOUNT_MAX = 'DEPOSIT_CRAB_SET_AMOUNT_MAX',
  DEPOSIT_CRAB_CHANGE_SLIPPAGE = 'DEPOSIT_CRAB_CHANGE_SLIPPAGE',
  WITHDRAW_CRAB_SET_AMOUNT_MAX = 'WITHDRAW_CRAB_SET_AMOUNT_MAX',
  WITHDRAW_CRAB_CHANGE_SLIPPAGE = 'WITHDRAW_CRAB_CHANGE_SLIPPAGE',
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
