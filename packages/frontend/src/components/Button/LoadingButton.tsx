import { ButtonProps, ButtonTypeMap, CircularProgress, ExtendButtonBase } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { PrimaryButton } from '.'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
  }),
)

const LoadingButton: React.FC<ButtonProps & { isLoading: boolean }> = (props) => {
  const { children, isLoading, ...rest } = props

  return (
    <PrimaryButton {...rest} disabled={isLoading}>
      {isLoading ? <CircularProgress color="primary" size="1.5rem" /> : children}
    </PrimaryButton>
  )
}

export default LoadingButton
