import { PrimaryButton } from '@components/Button'
import { Box, Divider, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtom } from 'jotai'
import { seeLPIntroAtom } from 'pages/lp'
import React from 'react'
import { useBuyAndLP } from 'src/state/squeethPool/hooks'
import { SimpleButton } from './LPIntroCard'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(3, 0),
      borderRadius: theme.spacing(2),
      maxHeight: '65vh',
      overflow: 'scroll',
    },
    headerMenu: {
      backgroundColor: theme.palette.background.stone,
      borderRadius: theme.spacing(1.5),
      padding: theme.spacing(1),
    },
    helpButton: {
      borderLeft: `1px solid ${theme.palette.divider}`,
    },
  }),
)

const LPTrade: React.FC = () => {
  const classes = useStyles()
  const [, setSeeLPIntro] = useAtom(seeLPIntroAtom)
  const buyAndLP = useBuyAndLP()

  return (
    <div className={classes.container}>
      <Box display="flex" justifyContent="space-between" alignItems="center" px={3} mb={2}>
        <Box display="flex" alignItems="center">
          <Box display="flex" alignItems="center" className={classes.headerMenu} height="100%">
            <SimpleButton style={{ opacity: '1', fontSize: '20px' }} size="small">
              Buy
            </SimpleButton>
            <Typography variant="caption" color="textSecondary">
              or
            </Typography>
            <SimpleButton style={{ opacity: '.3', fontSize: '20px' }} size="small">
              Mint
            </SimpleButton>
            <div className={classes.helpButton}>
              <SimpleButton
                onClick={() => setSeeLPIntro(true)}
                style={{ opacity: '.3', fontSize: '20px' }}
                size="small"
              >
                Help
              </SimpleButton>
            </div>
          </Box>
          <SimpleButton style={{ opacity: '.3', fontSize: '20px' }} size="small">
            › LP
          </SimpleButton>
        </Box>
        <PrimaryButton style={{ minWidth: 120 }} onClick={() => buyAndLP()}>
          Continue
        </PrimaryButton>
      </Box>
      <Divider />
      <Box></Box>
    </div>
  )
}

export default LPTrade
