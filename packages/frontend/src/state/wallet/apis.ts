import axios from 'axios'
import * as Sentry from '@sentry/nextjs'

export const checkIsValidAddress = async (address: string) => {
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  const { data } = await axios.get<{ valid: boolean }>(`/api/isValidAddress?address=${address}`)

  if (!data.valid) {
    Sentry.captureMessage(`Risk address ${address} is blocked.`)
  }

  return data.valid
}
