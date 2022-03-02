import { createStyles, makeStyles, Box } from '@material-ui/core'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    legendContainer: {
      display: 'flex',
      gap: '5px',
    },
  }),
)

type LegendBoxType = {
  bgColor: string
  text: string
}

const LegendBox: React.FC<LegendBoxType> = ({ bgColor, text }) => {
  const classes = useStyles()

  return (
    <Box className={classes.legendContainer}>
      <Box width={20} height={20} bgcolor={bgColor} />
      <div>{text}</div>
    </Box>
  )
}

export default LegendBox
