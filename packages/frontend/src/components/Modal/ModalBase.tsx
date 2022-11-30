import { Modal, ModalProps, Box } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import React from 'react'

const useModalStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '80%',
      maxWidth: '640px',
      maxHeight: '90%',
      background: theme.palette.background.default,
      borderRadius: 20,
      overflowY: 'auto',
      margin: '5em auto 0px',
      padding: theme.spacing(6),

      // hide scrollbar
      '&::-webkit-scrollbar': {
        width: '0 !important',
      },
      overflow: '-moz-scrollbars-none',
      msOverflowStyle: 'none',
    },
  }),
)

const ModalBase: React.FC<ModalProps> = ({ children, ...props }) => {
  const classes = useModalStyles()

  return (
    <Modal {...props}>
      <Box className={classes.container}>{children}</Box>
    </Modal>
  )
}

export default ModalBase
