import React from 'react'
import { useAtomValue } from 'jotai'

import { activePositionsAtom } from '@state/positions/atoms'
import { poolAtom } from '@state/squeethPool/atoms'
import { LPTable } from '@components/Lp/LPTable'
import NoPosition from './NoPosition'

const LPPositions: React.FC = () => {
  const pool = useAtomValue(poolAtom)
  const activePositions = useAtomValue(activePositionsAtom)

  if (activePositions.length === 0) {
    return <NoPosition noPositionText="No active LP position." ctaText="open a position." ctaLink="/lp" />
  }

  return <LPTable isLPage={false} pool={pool!} />
}

export default LPPositions
