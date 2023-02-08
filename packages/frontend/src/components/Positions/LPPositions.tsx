import React from 'react'
import { useAtomValue } from 'jotai'
import { Typography } from '@material-ui/core'

import { activePositionsAtom } from '@state/positions/atoms'
import { poolAtom } from '@state/squeethPool/atoms'
import { LPTable } from '@components/Lp/LPTable'

const LPPositions: React.FC = () => {
  const pool = useAtomValue(poolAtom)
  const activePositions = useAtomValue(activePositionsAtom)

  if (activePositions.length === 0) {
    return (
      <Typography variant="body1" color="textSecondary">
        No active LP position
      </Typography>
    )
  }

  return <LPTable isLPage={false} pool={pool!} />
}

export default LPPositions
