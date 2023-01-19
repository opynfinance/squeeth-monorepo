import { format } from 'date-fns'
import type { NextApiRequest, NextApiResponse } from 'next'

const TWELVE_DATA_API = 'https://api.twelvedata.com'

/**
 * Get Historical price using https://twelvedata.com/docs#complex-data complex data API
 */
const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { timestamps, interval, pair, tz } = req.query

  if (timestamps instanceof Array) {
    res.status(400).json({ status: 'error', message: 'Array params is not supported' })
    return
  }

  const timestampArr = timestamps.split(',')
  const methods = generateMethodData(timestampArr, interval)

  const resp = await fetch(`${TWELVE_DATA_API}/complex_data?apikey=${process.env.NEXT_PUBLIC_TWELVEDATA_APIKEY}`, {
    method: 'POST',
    body: JSON.stringify({
      symbols: [pair],
      timezone: tz,
      intervals: [interval],
      outputsize: 1,
      methods,
    }),
  })

  const respJson = await resp.json()
  // return res.status(200).json(respJson)

  const [current, ...rest] = respJson.data as Array<any>

  // complex_data API returns current price, historical price for each timestamp
  // So rest value will be in the format [1st historical price, current price, 2nd historical price, current price, ...]
  // So filtering historical price
  const priceData = rest.filter((_, index) => index % 2 === 0)

  if (timestampArr.length !== priceData.length) {
    res.status(400).json({ status: 'error', message: 'Timestamps size and price data length mis match' })
    return
  }

  const resultJson = timestampArr.reduce((acc, timestamp, index) => {
    const priceResp = priceData[index]
    if (priceResp.status === 'error') {
      acc[timestamp] = current.values[0].close
    } else {
      acc[timestamp] = priceResp.values[0].close
    }
    return acc
  }, {} as { [key: string]: string })

  res.status(200).json(resultJson)
}

// Generate method param from timestamps that's needed to sent to twelvedata API
const generateMethodData = (timestampArr: string[], interval: string | string[]) => {
  const methods = []

  for (const timestamp of timestampArr) {
    const date = format(new Date(Number(timestamp)).setUTCSeconds(0, 0), 'yyyy-MM-dd HH:mm:ss')

    const params = {
      interval,
      start_date: date,
      end_date: date,
      symbols: ['ETH/USD'],
    }
    methods.push('time_series', params)
  }

  return methods
}

export default handleRequest
