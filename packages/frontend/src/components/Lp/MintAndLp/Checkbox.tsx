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

interface CustomCheckboxProps {
  name: string
  label: string
  isChecked: boolean
  onChange: (value: boolean) => void
  color?: CheckboxProps['color']
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ name, label, isChecked, onChange, color = 'primary' }) => {
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
          color={color}
        />
      }
      label={label}
    />
  )
}

export default CustomCheckbox
