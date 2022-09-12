import { init, track } from '@amplitude/analytics-browser'

if (process.env.NEXT_PUBLIC_AMPLITUDE_KEY) init(process.env.NEXT_PUBLIC_AMPLITUDE_KEY)
