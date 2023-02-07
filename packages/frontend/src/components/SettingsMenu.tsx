import { Backdrop, Button, Link as MatLink, Switch } from '@material-ui/core'
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
import { useEffect, useState } from 'react'
import { canStoreCookies, CookieNames, setCookie } from '@utils/cookies'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'

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

const discordLink = 'https://tiny.cc/opyndiscord'
const docsLink = 'https://opyn.gitbook.io/opyn-hub/'

const SettingMenu = () => {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const [isOver, setIsOver] = useState(false)
  const [currentlyOver, setCurrentlyOver] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [openCookieModal, setOpenCookieModal] = useState(false)
  const [consent, setCookieConsent] = useState(canStoreCookies())
  const { track } = useAmplitude()
  const open = Boolean(anchorEl)
  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleModal = () => {
    handleClose()
    setOpenModal((prevState) => {
      return !prevState
    })
  }

  useEffect(() => {
    document.body.style.overflow = openModal ? 'hidden' : 'none'
  }, [openModal])

  const handleMouseOver = (current: string, isOver: boolean) => {
    setCurrentlyOver(current)
    setIsOver(isOver)
  }

  const handleCookieModal = () => {
    handleClose()
    setCookieConsent(canStoreCookies())
    setOpenCookieModal((prevState) => !prevState)
  }

  const acceptCookie = () => {
    setCookieConsent(true)
    setCookie(CookieNames.Consent, 'true')
  }

  const handleCookieConsentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    track(SITE_EVENTS.TOGGLE_COOKIE_CONSENT, { status: event.target.checked })
    setCookieConsent(event.target.checked)
    setCookie(CookieNames.Consent, event.target.checked.toString())
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
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.link}
            onClick={() => track(SITE_EVENTS.CLICK_DISCORD, { link: discordLink })}
          >
            Discord
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a
            href={docsLink}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.link}
            onClick={() => track(SITE_EVENTS.CLICK_DOCS, { link: docsLink })}
          >
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
        BackdropComponent={Backdrop}
        disableScrollLock
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
                    onClick={() => track(SITE_EVENTS.CLICK_TERMS_OF_SERVICE)}
                  >
                    Squeeth User Terms of Service
                  </a>
                </Link>
              </Typography>
              <Link href="/terms-of-service">
                <a target="_blank" onClick={() => track(SITE_EVENTS.CLICK_TERMS_OF_SERVICE)}>
                  <NorthEastOutlinedIcon />
                </a>
              </Link>
            </ListItem>
            <ListItem
              className={classes.legalLinks}
              style={{ marginBottom: '.75em' }}
              onMouseOver={() => handleMouseOver('pp', true)}
              onMouseOut={() => handleMouseOver('pp', false)}
            >
              <Typography style={{ display: 'flex', alignItems: 'center' }}>
                <InfoOutlinedIcon style={{ marginRight: '.25em' }} />
                <Link href="/privacy-policy">
                  <a
                    target="_blank"
                    style={{ textDecoration: isOver && currentlyOver === 'pp' ? 'underline' : 'none' }}
                    onClick={() => track(SITE_EVENTS.CLICK_PRIVACY_POLICY)}
                  >
                    Opyn Privacy Policy
                  </a>
                </Link>
              </Typography>
              <Link href="/privacy-policy">
                <a target="_blank" onClick={() => track(SITE_EVENTS.CLICK_PRIVACY_POLICY)}>
                  <NorthEastOutlinedIcon />
                </a>
              </Link>
            </ListItem>
          </List>
          <Typography>This app uses the following third-party APIs:</Typography>
          <List style={{ maxHeight: '400px', overflow: 'auto' }}>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Alchemy</ListItemText>
              </Typography>
              <ListItemText>The app fetches on-chain data and constructs contract calls with Alchemy API</ListItemText>
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
              <ListItemText>The app logs anonymized usage data to make improvements</ListItemText>
            </ListItem>
            <ListItem className={classes.thirdPartyItems}>
              <Typography className={classes.thirdPartyTitle}>
                <InfoOutlinedIcon style={{ marginRight: '.5em' }} />
                <ListItemText>Amplitude</ListItemText>
              </Typography>
              <ListItemText>The app logs anonymized usage statistics to improve over time</ListItemText>
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
              <ListItemText>{`The app fetches blockchain data from the Graph's hosted service`}</ListItemText>
            </ListItem>
          </List>
        </Box>
      </Modal>

      <Modal
        open={openCookieModal}
        onClose={handleCookieModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box className={classes.legalModal}>
          <Typography style={{ marginBottom: '1em' }} id="modal-modal-title" variant="h6" component="h2">
            Cookies Settings
          </Typography>
          <Typography style={{ marginBottom: '.75em', fontSize: '13px' }}>
            We use cookies to support technical features that enhance your user experience and analyze frontend traffic.
            To learn more about these methods, including how to disable them, view our{' '}
            <MatLink href={`${location.origin}/privacy-policy`} target="_blank">
              Privacy Policy.
            </MatLink>
          </Typography>

          {consent ? (
            <Switch
              checked={consent}
              onChange={handleCookieConsentChange}
              inputProps={{ 'aria-label': 'controlled' }}
            />
          ) : (
            <Button variant="outlined" color="primary" onClick={acceptCookie}>
              I Accept Cookies
            </Button>
          )}
        </Box>
      </Modal>
    </>
  )
}

export default SettingMenu
