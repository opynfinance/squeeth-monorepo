import { TextField, StandardTextFieldProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'

import useTextStyles from '@styles/useTextStyles'

const useInputBaseStyles = makeStyles((theme) =>
  createStyles({
    labelRoot: {
      '& ~ $inputRoot': {
        marginTop: '24px',
      },
    },
    labelFocused: {
      color: theme.palette.primary.main,
    },
    inputRoot: {
      padding: theme.spacing(0.75, 1.5),
      fontSize: '14px',
      fontFamily: 'DM Mono',
    },
    inputBorder: {
      border: '2px solid',
      borderColor: theme.palette.background.lightStone,
      borderRadius: '12px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
    inputError: {
      borderColor: theme.palette.error.dark,
    },
  }),
)

interface InputBaseCustomProps {
  hasBorder?: boolean
  readOnly?: boolean
}
export type InputBaseProps = StandardTextFieldProps & InputBaseCustomProps

const InputBase: React.FC<InputBaseProps> = ({
  InputProps,
  InputLabelProps,
  hasBorder = true,
  readOnly = false,
  ...props
}) => {
  const classes = useInputBaseStyles()
  const textClasses = useTextStyles()

  return (
    <TextField
      InputLabelProps={{
        classes: {
          root: clsx(classes.labelRoot, textClasses.lightestFontColor),
          focused: clsx(classes.labelFocused, textClasses.lightFontColor),
        },
        ...InputLabelProps,
      }}
      InputProps={{
        disableUnderline: true,
        readOnly,
        classes: {
          root: clsx(classes.inputRoot, hasBorder && classes.inputBorder),
          focused: classes.inputFocused,
          error: classes.inputError,
        },
        ...InputProps,
      }}
      {...props}
    />
  )
}

export default InputBase
