import { InputAdornment, TextField, Tooltip } from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import React from 'react'

import { useWorldContext } from '@context/world'

const IV: React.FC = () => {
  const { volMultiplier, setVolMultiplier } = useWorldContext()

  return (
    <div>
      <TextField
        variant="outlined"
        label="Vol Multiplier"
        value={volMultiplier}
        style={{ width: 300 }}
        size="small"
        onChange={(event) => setVolMultiplier(event.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Multiplies the at-the-money vol by this amount">
                <InfoOutlinedIcon fontSize="small" />
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />
    </div>
  )
}

export default IV
