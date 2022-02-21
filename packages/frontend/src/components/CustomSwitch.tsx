import { createStyles, makeStyles, Typography } from '@material-ui/core'
import React from 'react'
import clsx from 'clsx'

const useStyles = makeStyles((theme) =>
  createStyles({
    wrapper: {
      display: 'flex',
      alignItems: 'center',
    },
    switchItem: {
      padding: '3px 8px',
      margin: '4px',
      cursor: 'pointer',
      borderRadius: 12,
      '& p': {
        fontSize: 14,
      },
    },
    selectedItem: {
      background: '#ddd',
      '& p': {
        color: '#333',
      },
    },
  }),
)

type SwitchItem = {
  id: string
  text: string
}

type CustomSwitchType = {
  items: SwitchItem[]
  value: SwitchItem
  onChange: (val: SwitchItem) => void
}

const CustomSwitch: React.FC<CustomSwitchType> = ({ items, value, onChange }) => {
  const classes = useStyles()

  return (
    <div className={classes.wrapper}>
      {items.map((item) => (
        <div
          key={item.id}
          className={clsx(classes.switchItem, item.id === value.id && classes.selectedItem)}
          onClick={() => onChange(item)}
        >
          <Typography>{item.text}</Typography>
        </div>
      ))}
    </div>
  )
}

export default CustomSwitch
