import { ROUTES, EXTERNAL_LINKS } from '@constants/routes'
import { LANDING_EVENTS, SITE_EVENTS } from '@utils/amplitude'

export const navLinks = [
  { label: 'Strategies', link: ROUTES.STRATEGY.CRAB },
  { label: 'Squeeth', link: ROUTES.SQUEETH },
  { label: 'Auction', link: EXTERNAL_LINKS.AUCTION, analyticsEvent: SITE_EVENTS.NAV_AUCTION },
  {
    label: 'FAQ',
    link: EXTERNAL_LINKS.FAQ,
    analyticsEvent: SITE_EVENTS.NAV_FAQ,
  },
]

export const footerLinks = [
  { label: 'Developers', link: EXTERNAL_LINKS.DEVELOPERS, analyticsEvent: LANDING_EVENTS.NAV_DEVELOPERS },
  { label: 'Blog', link: EXTERNAL_LINKS.MEDIUM, analyticsEvent: LANDING_EVENTS.NAV_BLOG },
  {
    label: 'Security',
    link: EXTERNAL_LINKS.SECURITY,
    analyticsEvent: LANDING_EVENTS.NAV_SECURITY,
  },
]
