import axios from 'axios'
import type { NextApiRequest, NextApiResponse } from 'next'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    try {
      const response = await axios.get(`${process.env.DEFILLAMA_ENDPOINT}/tvl/opyn`)
      res.status(200).json(response.data)
    } catch (error) {
      console.error('Error fetching data from Defillama:', { error })
      res.status(500).json({ error: 'Error fetching data from Defillama' })
    }
  } else {
    // Handle any other HTTP method
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

export default handleRequest
