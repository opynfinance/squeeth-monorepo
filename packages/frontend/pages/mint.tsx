import { MintSqueeth } from '@components/Lp/GetSqueeth'
import Nav from '@components/Nav'
import { Box, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Link from 'next/link'
import React from 'react'
import { useFirstValidVault } from 'src/state/positions/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    title: {
      marginTop: theme.spacing(2),
      color: theme.palette.primary.main,
    },
    getSqueethCard: {
      width: '400px',
      background: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
      overflow: 'auto',
      margin: 'auto',
      marginTop: theme.spacing(4),
      padding: theme.spacing(2, 0),
    },
  }),
)

const MintPage: React.FC = () => {
  const classes = useStyles()
  const { vaultId } = useFirstValidVault()

  return (
    <div>
      <Nav />
      <Typography align="center" variant="h6" className={classes.title}>
        Mint Squeeth
      </Typography>

      <Box className={classes.getSqueethCard}>
        <MintSqueeth onMint={() => console.log('Minted')} showManageLink />
      </Box>
    </div>
  )
}

export default MintPage
