import { Button, createStyles, makeStyles, Typography } from '@material-ui/core'
import Image from 'next/image'
import React from 'react'

import discordIcon from '../../../public/images/discord.svg'
import { Modal, ModalProps } from '../Modal/Modal'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      padding: theme.spacing(4),
    },
    logoTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
    },
    info: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
    },
  }),
)

export const WelcomeModal: React.FC<Omit<ModalProps, 'title'>> = (props) => {
  const classes = useStyles()

  return (
    <Modal title="Welcome to Squeeth Testnet!" {...props}>
      <Typography variant="subtitle1">We invite you to squeeth around! 🐱</Typography>
      <div className={classes.info}>
        <a href="https://faucet.ropsten.be/" target="_blank" rel="noopener noreferrer">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Get test ETH </span>
          </Button>
        </a>
      </div>
      <div className={classes.info}>
        <a href="https://discord.gg/ztEuhjyaBF" target="_blank" rel="noopener noreferrer">
          <Button style={{ color: '#000', textTransform: 'none' }} variant="contained" color="primary">
            <span>Squeeth Together</span>
            <span style={{ display: 'flex', marginLeft: '5px' }}>
              <Image src={discordIcon} alt="discord" width={27} height={27} />
            </span>
          </Button>
        </a>
      </div>
    </Modal>
  )
}
