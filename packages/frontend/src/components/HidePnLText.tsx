import Typography from '@material-ui/core/Typography'
import { LinkWrapper } from './LinkWrapper'
import { positionTypeAtom } from 'src/state/positions/atoms'
import { useAtomValue } from 'jotai'
import { PositionType } from 'src/types'

export const HidePnLText: React.FC = () => {
  const positionType = useAtomValue(positionTypeAtom)

  return (
    <Typography variant="caption" color="textSecondary">
      <br />
      To calculate your PnL because you have{' '}
      {positionType === PositionType.LONG ? (
        <span>LPed, participated in crab auctions, or wallet transferred oSQTH</span>
      ) : (
        <span>short position</span>
      )}{' '}
      , please use{' '}
      <LinkWrapper href="https://docs.google.com/spreadsheets/d/1iy5N3qy6g2xd2_BcsY_Hv0pKdyceC1h7y269KssOG8s/edit#gid=1267496112">
        SqueethLab.
      </LinkWrapper>
      &nbsp; We are currently working on adding this into the frontend.
    </Typography>
  )
}
