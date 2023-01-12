import React from 'react'
import InputBase, { InputBaseProps } from './InputBase'

const DECIMAL_REGEX = RegExp('^[0-9]*[.]{1}[0-9]*$')

interface InputNumberCustomProps extends InputBaseProps {
  onInputChange?: (value: string) => void
}
export type InputNumberProps = InputNumberCustomProps

const InputNumber = React.forwardRef<any, InputNumberProps>(
  ({ value, onInputChange = () => {}, inputProps, ...props }, ref) => {
    const handleChange = (val: string) => {
      if (isNaN(Number(val))) {
        return onInputChange('0')
      }

      if (Number(val) < 0) {
        return onInputChange('0')
      }

      if (Number(val) !== 0) {
        // if it is integer, remove leading zeros
        if (!DECIMAL_REGEX.test(val)) {
          val = Number(val).toString()
        }
      } else {
        // remain input box w single zero, but keep zero when have decimal
        val = val.replace(/^[0]+/g, '0')
        // if it is no value
        if (val.length === 0) {
          val = '0'
        }
      }

      return onInputChange(val)
    }

    return (
      <InputBase
        ref={ref}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="0"
        autoComplete="false"
        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', ...inputProps }}
        {...props}
      />
    )
  },
)
InputNumber.displayName = 'InputNumber'

export default InputNumber
