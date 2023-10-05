import type { NextApiRequest, NextApiResponse } from 'next'
import { getAddressStrikeCount } from 'src/server/firebase-admin'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(400).json({ message: 'Only GET is allowed' })
  }

  const { address } = req.query

  try {
    const count = await getAddressStrikeCount(address as string)
    return res.status(200).json({ count })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: error })
  }
}

export default handleRequest
