import { createStyles, makeStyles, Box, Tooltip } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import React from 'react'

const useStyles = makeStyles(() =>
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
  tooltip?: string
}

const LegendBox: React.FC<LegendBoxType> = ({ bgColor, text, tooltip }) => {
  const classes = useStyles()

  return (
    <Box className={classes.legendContainer}>
      <Box width={20} height={20} bgcolor={bgColor} />
      <div>{text}</div>
      {tooltip && (
        <Tooltip title={tooltip}>
          <InfoIcon fontSize="small" />
        </Tooltip>
      )}
    </Box>
  )
}

export default LegendBox
