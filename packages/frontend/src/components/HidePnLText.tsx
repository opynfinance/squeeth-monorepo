import { Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import { positionTypeAtom } from '@state/positions/atoms'
import { PositionType } from 'src/types'
import { LinkWrapper } from './LinkWrapper'

const useStyles = makeStyles({
  text: {
    fontSize: '15px',
    color: 'rgb(255, 255, 255)',
  },
})

export const HidePnLText: React.FC = () => {
  const classes = useStyles()

  const positionType = useAtomValue(positionTypeAtom)

  return (
    <Typography variant="body2" className={classes.text}>
      {positionType !== PositionType.LONG && <span>Coming soon.</span>} Please use{' '}
      <LinkWrapper href="https://docs.google.com/spreadsheets/d/1iy5N3qy6g2xd2_BcsY_Hv0pKdyceC1h7y269KssOG8s/edit#gid=1267496112">
        SqueethLab
      </LinkWrapper>
    </Typography>
  )
}
