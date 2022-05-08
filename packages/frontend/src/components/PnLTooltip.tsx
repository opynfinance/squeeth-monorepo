import { Tooltips } from '@constants/enums'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import HelpOutline from '@material-ui/icons/HelpOutline'
import { PnLType } from '../types/index'
import { LinkWrapper } from './LinkWrapper'

const useStyles = makeStyles((theme) =>
  createStyles({
    infoIcon: {
      fontSize: '16px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

interface PnLTooltipProps {
  pnlType: PnLType
}

export const PnLTooltip: React.FC<PnLTooltipProps> = ({ pnlType }) => {
  const classes = useStyles()
  const pnlText = pnlType === PnLType.Unrealized ? Tooltips.UnrealizedPnL : Tooltips.RealizedPnL
  return (
    <Tooltip
      interactive
      title={
        <>
          {pnlText} <br />
          <br /> {Tooltips.PnLExplanation}
          <br />
          <LinkWrapper href="https://twitter.com/wadepros/status/1507008456766595081?s=20&t=BwhOBHz5azrdn0KsAb8TSA">
            Learn more
          </LinkWrapper>
        </>
      }
    >
      <HelpOutline fontSize="small" className={classes.infoIcon} />
    </Tooltip>
  )
}
