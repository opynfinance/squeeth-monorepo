import { SQUEETH_BASE_URL } from './index'

interface SeoDataType {
  TITLE: string
  DESCRIPTION: string
  OG_IMAGE: string
  OG_IMAGE_ALT: string
}

export const SEO_DEFAULTS: SeoDataType = {
  TITLE: 'Stack your ETH and Stables',
  DESCRIPTION: 'DeFi Investment Strategies Powered by Squeeth',
  OG_IMAGE: SQUEETH_BASE_URL + '/images/previews/opyn.png',
  OG_IMAGE_ALT: 'Opyn',
}

export const CRAB_SEO_DEFAULTS: SeoDataType = {
  TITLE: 'Opyn Crab Strategy - Stack USDC',
  DESCRIPTION:
    'Stack USDC during calm periods of ETH. The Crab strategy performs best when the price of ETH fluctuates within a relatively stable range.',
  OG_IMAGE: SQUEETH_BASE_URL + '/images/previews/crab.png',
  OG_IMAGE_ALT: 'Opyn Crab Strategy',
}

export const BULL_SEO_DEFAULTS: SeoDataType = {
  TITLE: 'Opyn Bull Strategy - Stack ETH',
  DESCRIPTION:
    'Stack ETH when ETH goes up, slow and steady. The Bull strategy performs best in zen (calm) markets, when the price of ETH increases slowly.',
  OG_IMAGE: SQUEETH_BASE_URL + '/images/previews/bull.png',
  OG_IMAGE_ALT: 'Opyn Bull Strategy',
}
