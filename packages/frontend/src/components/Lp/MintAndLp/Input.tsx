import { TextField, StandardTextFieldProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'

const useSimpleInputStyles = makeStyles((theme) =>
  createStyles({
    label: {
      opacity: 0.5,
      '& ~ $input': {
        marginTop: '24px',
      },
    },
    labelFocused: {
      color: theme.palette.primary.main,
      opacity: 0.8,
    },
    input: {
      padding: theme.spacing(0.75, 1.5),
      fontSize: '14px',
    },
    inputBorder: {
      border: '2px solid',
      borderColor: theme.palette.background.lightStone,
      borderRadius: '12px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
  }),
)

type CustomProps = {
  hasBorder?: boolean
}
type InputProps = StandardTextFieldProps & CustomProps

export const SimpleInput: React.FC<InputProps> = ({
  id,
  label,
  value,
  onChange,
  InputProps,
  InputLabelProps,
  hasBorder = true,
  ...props
}) => {
  const classes = useSimpleInputStyles()

  return (
    <TextField
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      InputLabelProps={{
        classes: {
          root: classes.label,
          focused: classes.labelFocused,
        },
        ...InputLabelProps,
      }}
      InputProps={{
        disableUnderline: true,
        classes: {
          root: clsx(classes.input, hasBorder && classes.inputBorder),
          focused: classes.inputFocused,
        },
        ...InputProps,
      }}
      {...props}
    />
  )
}
