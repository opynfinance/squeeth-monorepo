import { createStyles, makeStyles } from '@material-ui/core/styles'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useState } from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonWrapper: {
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      paddingBottom: '1em',
    },

    link: {
      color: '#2ce6f9',
      textDecoration: 'underline',
    },
    textContainer: {
      display: 'flex',
      alignItems: 'center',
      margin: '0 1em 2em 1em',
    },
    button: {
      fontSize: '13px',
      backgroundColor: '#2b8e99',
      color: '#ffffff',
      padding: '.75em 2em',
      borderRadius: 10,
      marginRight: '1em',
    },
    declineButton: {
      border: '1px solid #2b8e99',
      color: '#2ce6f9',
      borderRadius: 10,
      backgroundColor: '#283944',
      padding: '.75em 2em',
    },
    dialog: {
      background: '#283944',
    },
  }),
)
const CookieConsentPopup = () => {
  const classes = useStyles()
  const router = useRouter()
  const [cookies, setCookie] = useCookies(['restricted'])

  const [open, setOpen] = useState(!router.query?.restricted?.includes('true'))

  const handleClose = () => {
    if (cookies?.restricted) setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <div className={classes.dialog}>
        <div className={classes.textContainer}>
          <p>
            We use cookies to recognize visitors and analyze front end traffic. To learn more about these methods,
            including how to disable them, view our{' '}
            <Link href="/">
              <a className={classes.link}>Cookie Policy</a>
            </Link>
            .
          </p>
        </div>

        <div className={classes.buttonWrapper}>
          <Button
            className={classes.button}
            onClick={() => {
              setCookie('restricted', router.query?.restricted === 'true' ? `true,${router.query?.country}` : 'false')
              setOpen(false)
            }}
          >
            I Accept
          </Button>
          <Button className={classes.declineButton} onClick={() => setOpen(false)}>
            Decline
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default CookieConsentPopup
