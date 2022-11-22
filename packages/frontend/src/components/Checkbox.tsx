import {
  FormControlLabel,
  Checkbox as MaterialCheckbox,
  CheckboxProps as MaterialCheckboxProps,
} from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'

const useCheckboxStyles = makeStyles((theme) =>
  createStyles({
    root: {
      padding: 0,
      marginRight: theme.spacing(0.5),
    },
  }),
)

const useFormControlLabelStyles = makeStyles({
  root: {
    marginRight: 0,
  },
  label: {
    fontWeight: 500,
  },
})

interface CheckboxCustomProps {
  name: string
  label: string
  isChecked: boolean
  onInputChange: (value: boolean) => void
}

type CheckboxProps = MaterialCheckboxProps & CheckboxCustomProps

const Checkbox: React.FC<CheckboxProps> = ({ name, label, isChecked, onInputChange, ...props }) => {
  const formControlLabelClasses = useFormControlLabelStyles()
  const checkboxClasses = useCheckboxStyles()

  return (
    <FormControlLabel
      classes={formControlLabelClasses}
      control={
        <MaterialCheckbox
          className={checkboxClasses.root}
          checked={isChecked}
          onChange={(event) => onInputChange(event.target.checked)}
          name={name}
          {...props}
        />
      }
      label={label}
    />
  )
}

export default Checkbox
