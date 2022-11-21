import { FormControlLabel, Checkbox, CheckboxProps } from '@material-ui/core'
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
  onChange: (value: boolean) => void
}

const CustomCheckbox: React.FC<CheckboxCustomProps & CheckboxProps> = ({
  name,
  label,
  isChecked,
  onChange,
  ...props
}) => {
  const formControlLabelClasses = useFormControlLabelStyles()
  const checkboxClasses = useCheckboxStyles()

  return (
    <FormControlLabel
      classes={formControlLabelClasses}
      control={
        <Checkbox
          className={checkboxClasses.root}
          checked={isChecked}
          onChange={(event) => onChange(event.target.checked)}
          name={name}
          {...props}
        />
      }
      label={label}
    />
  )
}

export default CustomCheckbox
