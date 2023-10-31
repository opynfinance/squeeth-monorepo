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

export const updateBlockedAddress = async (address: string) => {
  // if (process.env.NODE_ENV === 'development') {
  //   return true
  // }

  const response = await axios.post<{ message: string; visitCount: number }>('/api/updateBlockedAddress', { address })
  return response.data.visitCount
}

export const getAddressStrikeCount = async (address: string) => {
  const { data } = await axios.get<{ count: number }>(`/api/strikes?address=${address}`)
  return data.count
}
