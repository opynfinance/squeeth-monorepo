import { Typography } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import { positionTypeAtom } from '@state/positions/atoms'
import { PositionType } from 'src/types'
import { LinkWrapper } from './LinkWrapper'

export const HidePnLText: React.FC<{ isSmall?: boolean }> = ({ isSmall = false }) => {
  const positionType = useAtomValue(positionTypeAtom)

  return (
    <Typography variant={isSmall ? 'body2' : 'body1'}>
      {positionType !== PositionType.LONG && <span>Coming soon.</span>} Please use{' '}
      <LinkWrapper href="https://docs.google.com/spreadsheets/d/1iy5N3qy6g2xd2_BcsY_Hv0pKdyceC1h7y269KssOG8s/edit#gid=1267496112">
        SqueethLab
      </LinkWrapper>
    </Typography>
  )
}
