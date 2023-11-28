import { WHITELISTED_DATACENTER_ORGANIZATIONS } from '../constants'

type ApiResponse = {
  success: boolean
  message: string
  fraud_score: number
  country_code: string
  region: string
  city: string
  ISP: string
  ASN: number
  operating_system: string
  browser: string
  organization: string
  is_crawler: boolean
  timezone: string
  mobile: boolean
  host: string
  proxy: boolean
  vpn: boolean
  tor: boolean
  active_vpn: boolean
  active_tor: boolean
  device_brand: string
  device_model: string
  recent_abuse: boolean
  bot_status: boolean
  connection_type: string
  abuse_velocity: string
  zip_code: string
  latitude: number
  longitude: number
  request_id: string
}

async function checkUserIP(ipAddress: string): Promise<ApiResponse | null> {
  const key = process.env.IPQS_API_KEY
  const strictness = 1 // This optional parameter controls the level of strictness for the lookup. Setting this option higher will increase the chance for false-positives as well as the time needed to perform the IP analysis. Increase this setting if you still continue to see fraudulent IPs with our base setting (level 1 is recommended) or decrease this setting for faster lookups with less false-positives. Current options for this parameter are 0 (fastest), 1 (recommended), 2 (more strict), or 3 (strictest).
  const allow_public_access_points = 'true' // Bypasses certain checks for IP addresses from education and research institutions, schools, and some corporate connections to better accommodate audiences that frequently use public connections. This value can be set to true to make the service less strict while still catching the riskiest connections.
  const url =
    'https://www.ipqualityscore.com/api/json/ip/' +
    key +
    '/' +
    ipAddress +
    '?strictness=' +
    strictness +
    '&allow_public_access_points=' +
    allow_public_access_points
  const result = await getIPQUrl(url)
  if (result !== null) {
    return result
  } else {
    return null
  }
}

async function getIPQUrl(url: string): Promise<ApiResponse | null> {
  try {
    const response = await fetch(url)
    const data = await response.json()
    return data
  } catch (error) {
    return null
  }
}

export async function isVPN(ipAddress: string): Promise<boolean> {
  const ipResult = await checkUserIP(ipAddress)
  if (ipResult === null) {
    return false
  }

  const isSuspectedToBeVPN = ipResult.vpn === true || ipResult.tor === true
  if (isSuspectedToBeVPN) {
    const org = ipResult.organization

    // exclude datacenter IPs
    // organization should include one of WHITELISTED_DATACENTER_ORGANIZATIONS
    const isWhitelistedOrg = WHITELISTED_DATACENTER_ORGANIZATIONS.some((whitelistedOrg) =>
      org.toLowerCase().includes(whitelistedOrg.toLowerCase()),
    )
    const isActiveVPN = ipResult.active_vpn === true

    // label as isAllowedOrg only if isWhitelistedOrg and not a active VPN
    const isAllowedOrg = isWhitelistedOrg && !isActiveVPN
    return !isAllowedOrg
  }

  return false
}
