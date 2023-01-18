import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Slide from '@material-ui/core/Slide'
import ReactDOM from 'react-dom'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { openCrispChat, sendCrispChatMessage } from '@utils/crisp-chat'
import useAmplitude from './useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'

export const useStyles = makeStyles((theme) =>
  createStyles({
    popup: {
      position: 'fixed',
      bottom: '90px',
      right: '20px',
      maxWidth: '20vw',
      border: `1px solid #303436`,
      padding: '10px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      backgroundColor: '#191B1C',
      [theme.breakpoints.down('lg')]: {
        maxWidth: '20vw',
      },
      [theme.breakpoints.down('md')]: {
        maxWidth: '30vw',
      },
      [theme.breakpoints.down('sm')]: {
        maxWidth: '40vw',
      },
      [theme.breakpoints.down('xs')]: {
        maxWidth: '60vw',
      },
    },
    popupText: {
      margin: 0,
    },
    popupActions: {
      display: 'flex',
      gap: '10px',
    },
    popupAction: {
      padding: '10px',
      backgroundColor: 'transparent',
      color: '#fff',
      border: `1px solid #303436`,
      borderRadius: '8px',
      cursor: 'pointer',
      transitionDuration: '200ms',
      '&:hover': {
        backgroundColor: theme.palette.background.default,
        color: '#000',
      },
    },
  }),
)

interface PopupAction {
  label?: string
  closeAfterAction?: boolean
  analyticsEvent?: string
  isClosingAction?: boolean
  onClick?: () => void
}

export interface PopupConfig {
  text?: string
  actions?: PopupAction[]
}

interface PopupProps extends PopupConfig {
  showPopup?: boolean
  hide?: () => void
}

const Popup = ({ text, actions = [], showPopup, hide }: PopupProps) => {
  const classes = useStyles()
  const { track } = useAmplitude()

  const onClickAction = useCallback(
    (action: PopupAction) => {
      action.onClick?.()
      action.analyticsEvent ? track(action.analyticsEvent, { action: action.label }) : null
      action.closeAfterAction ? hide?.() : null
    },
    [hide],
  )
  return (
    <Slide direction="left" in={showPopup} mountOnEnter unmountOnExit>
      <div className={classes.popup}>
        <p className={classes.popupText}>{text ?? ''}</p>
        <div className={classes.popupActions}>
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => onClickAction(action)}
              type="button"
              className={classes.popupAction}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </Slide>
  )
}
const popupRoot = typeof document !== 'undefined' ? document.getElementById('popup') : undefined

const usePopup = (config: PopupConfig) => {
  const [showPopup, setShowPopup] = useState(false)
  const { track } = useAmplitude()

  const show = useCallback(() => {
    setShowPopup(true)
    track(SITE_EVENTS.SHOW_ERROR_FEEDBACK_POPUP, { title: config?.text })
  }, [track, config?.text])

  const hide = () => setShowPopup(false)

  const actions = useMemo(() => {
    return (config.actions ?? []).map((action) => ({
      ...action,
      onClick: action.isClosingAction ? hide : action.onClick,
    }))
  }, [config.actions])

  useEffect(() => {
    ReactDOM.render(
      <Popup hide={hide} showPopup={showPopup} text={config.text} actions={actions} />,
      popupRoot as HTMLElement,
    )
  }, [showPopup, config.text, actions])

  return { show, hide }
}

export default usePopup

export const GenericErrorPopupConfig: PopupConfig = {
  text: 'Oops, something is not right on our side, would you like to speak to our support team ?',
  actions: [
    {
      label: 'Yes',
      closeAfterAction: true,
      analyticsEvent: SITE_EVENTS.CLICK_ERROR_FEEDBACK_ACTION,
      onClick: () => {
        sendCrispChatMessage('Hi, I have encountered an issues with the site, need help!')
        openCrispChat()
      },
    },
    {
      label: 'No Thanks',
      analyticsEvent: SITE_EVENTS.CLICK_ERROR_FEEDBACK_ACTION,
      isClosingAction: true,
    },
  ],
}
