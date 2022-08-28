import axios from 'axios'
import * as Sentry from '@sentry/nextjs'

export const checkIsValidAddress = async (address: string) => {
  const { data } = await axios.get<{ valid: boolean }>(`/api/isValidAddress?address=${address}`)

  console.log('valid address check')

  if (!data.valid) {
    Sentry.captureMessage(`Risk address ${address} is blocked.`)
  }

  return data.valid
}
