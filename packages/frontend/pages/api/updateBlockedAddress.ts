import type { NextApiRequest, NextApiResponse } from 'next'
import { updateBlockedAddress } from 'src/server/firebase-admin'

const handleRequest = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') return res.status(400).json({ message: 'Only post is allowed' })

  const { address } = req.body

  try {
    const visitCount = await updateBlockedAddress(address)
    return res.status(200).json({ message: 'success', visitCount })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: error })
  }
}

export default handleRequest
