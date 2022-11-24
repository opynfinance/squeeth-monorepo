import Typography from '@material-ui/core/Typography'
import { LinkWrapper } from './LinkWrapper'
import { positionTypeAtom } from 'src/state/positions/atoms'
import { useAtomValue } from 'jotai'
import { PositionType } from 'src/types'

export const HidePnLText: React.FC = () => {
  const positionType = useAtomValue(positionTypeAtom)

  return (
    <Typography variant="body2">
      {positionType !== PositionType.LONG && <span>Coming soon.</span>} Please use{' '}
      <LinkWrapper href="https://docs.google.com/spreadsheets/d/1iy5N3qy6g2xd2_BcsY_Hv0pKdyceC1h7y269KssOG8s/edit#gid=1267496112">
        SqueethLab
      </LinkWrapper>
    </Typography>
  )
}
