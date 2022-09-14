import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import * as Sentry from '@sentry/nextjs'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  const { address } = req.query
  let isValidAddress = true

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
      { headers: { Token: process.env.AML_API_KEY ?? '' } },
    )
   
    if (data && data?.[0]?.rating)
      isValidAddress = (data?.[0].rating === 'highRisk') ? false : true 

    res.status(200).json({ valid: isValidAddress, madeThirdPartyConnection: true })

  } catch (error) {
    // catches all reponses not 2XX from source
    if (error instanceof Error) {
      Sentry.captureMessage(`AML Check: Error occured when checking for address:${address}. Error: ${error.message} `)
    } else {
      Sentry.captureMessage(`AML Check: Error occured when checking for address:${address}. Error: ${JSON.stringify(error)}`)
    }

    res.status(200).json({ valid: true, madeThirdPartyConnection: false })
  }
}

export default handleRequest
