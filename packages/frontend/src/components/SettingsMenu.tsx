import { Button, Link as MatLink } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import MoreHorizIcon from '@material-ui/icons/MoreHorizOutlined'
import NorthEastOutlinedIcon from '@material-ui/icons/CallMade'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Modal from '@material-ui/core/Modal'
import Box from '@material-ui/core/Box'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import Link from 'next/link'
import { useState } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    navMenuStyle: {
      borderRadius: 6,
      marginTop: theme.spacing(1),
      minWidth: 180,
    },
    link: {
      display: 'flex',
      width: '100%',
    },
    legalModal: {
      margin: '8em auto 0px',
      width: '90%',
      maxWidth: '450px',
      background: '#181B1C',
      padding: '1em',
      borderRadius: 15,
      boxShadow: '5px 3px 32px -6px rgba(14,103,112,0.56)',
    },
    thirdPartyItems: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    thirdPartyTitle: {
      display: 'flex',
      alignItems: 'center',
    },
    legalLinks: {
      border: `1px solid ${theme.palette.primary.main}`,
      borderRadius: '20px',
      color: theme.palette.primary.main,
      backgroundColor: 'rgba(44, 230, 249, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  }),
)

const SettingMenu = () => {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const [isOver, setIsOver] = useState(false)
  const [currentlyOver, setCurrentlyOver] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const open = Boolean(anchorEl)
  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleModal = () => {
    handleClose()
    setOpenModal((prevState) => !prevState)
  }
  const handleMouseOver = (current: string, isOver: boolean) => {
    setCurrentlyOver(current)
    setIsOver(isOver)
  }

  return (
    <>
      <Button
        id="nav-menu-button"
        aria-controls={open ? 'nav-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <MoreHorizIcon color="primary" />
      </Button>
      <Menu
        className={classes.navMenuStyle}
        id="nav-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'nav-menu-button',
        }}
      >
        <MenuItem onClick={handleClose} key="discord">
          <a href="https://tiny.cc/opyndiscord" target="_blank" rel="noopener noreferrer" className={classes.link}>
            Discord
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a href="https://opyn.gitbook.io/squeeth/" target="_blank" rel="noopener noreferrer" className={classes.link}>
            Docs
          </a>
        </MenuItem>
        <MenuItem onClick={handleModal}>Legal & Privacy</MenuItem>
      </Menu>

      <Modal
        open={openModal}
        onClose={handleModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box className={classes.legalModal}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Legal & Privacy
          </Typography>
          <List style={{ marginBottom: '2em' }}>
            <ListItem
              className={classes.legalLinks}
              style={{ marginBottom: '.75em' }}
              onMouseOver={() => handleMouseOver('tos', true)}
              onMouseOut={() => handleMouseOver('tos', false)}
            >
              <Typography style={{ display: 'flex', alignItems: 'center' }}>
                <InfoOutlinedIcon style={{ marginRight: '.25em' }} />

                <Link href="/terms-of-service">
                  <a
                    target="_blank"
                    style={{ textDecoration: isOver && currentlyOver === 'tos' ? 'underline' : 'none' }}
                  >
                    Squeeth User Terms of Service
                  </a>
                </Link>
              </Typography>
              <Link href="/terms-of-service">
                <a target="_blank">
                  <NorthEastOutlinedIcon />
                </a>
              </Link>
            </ListItem>
            <ListItem
              className={classes.legalLinks}
              onMouseOver={() => handleMouseOver('pp', true)}
              onMouseOut={() => handleMouseOver('pp', false)}
            >
              <Typography style={{ display: 'flex', alignItems: 'center' }}>
                <InfoOutlinedIcon style={{ marginRight: '.25em' }} />
                <Link href="/privacy-policy">
                  <a
                    target="_blank"
                    style={{ textDecoration: isOver && currentlyOver === 'pp' ? 'underline' : 'none' }}
                  >
                    Opyn Privacy Policy
                  </a>
                </Link>
              </Typography>
              <Link href="/privacy-policy">
                <a target="_blank">
                  <NorthEastOutlinedIcon />
                </a>
              </Link>
            </ListItem>
          </List>
          <Typography>The app uses the following third-party APIs:</Typography>
          <List>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Alchemy</ListItemText>
              </Typography>
              <ListItemText>This app fetches on-chain data and constructs contract calls with Alchemy API</ListItemText>
            </ListItem>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Chainalysis</ListItemText>
              </Typography>
              <ListItemText>
                The app securely reviews your wallet address using the Chainalysis, Inc. API for risk and compliance
                reasons.{' '}
                <MatLink href={`${location.origin}/terms-of-service-faq`} target="_blank">
                  Learn More
                </MatLink>
              </ListItemText>
            </ListItem>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Fathom</ListItemText>
              </Typography>
              <ListItemText>This app logs anonymized usage data to make improvements</ListItemText>
            </ListItem>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Sentry</ListItemText>
              </Typography>
              <ListItemText>The app logs blocked address events using the Sentry</ListItemText>
            </ListItem>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>The Graph</ListItemText>
              </Typography>
              <ListItemText>{`This app fetches blockchain data from the Graph's hosted service`}</ListItemText>
            </ListItem>
          </List>
        </Box>
      </Modal>
    </>
  )
}

export default SettingMenu
