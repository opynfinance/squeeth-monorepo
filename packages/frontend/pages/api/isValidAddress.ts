import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import * as Sentry from '@sentry/nextjs'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { address } = req.query

  try {

    const { data } = await axios.post(
      `https://api.chainalysis.com/api/kyt/v1/users/${address}/withdrawaladdresses`,
      [
        {
          network: 'Ethereum',
          asset: 'ETH',
          address,
        },
      ],
      { headers: { Token: process.env.NEXT_PUBLIC_AML_API_KEY ?? '' } },
    )

    res.status(200).json({ valid: (data?.[0]?.rating ?? 'highRisk') !== 'highRisk' })

  } catch (error) {
    // catches all reponses not 2XX from source
    if (error instanceof Error) {
      Sentry.captureMessage(`AML Check: Error occured when checking for address:${address}. Error: ${error.message} `)
    } else {
      Sentry.captureMessage(`AML Check: Error occured when checking for address:${address}. Error: ${JSON.stringify(error)}`)
    }

    res.status(200).json({ valid: true })
  }
}

export default handleRequest
