import { Box, BoxProps, Tooltip, Typography, TypographyVariant } from '@material-ui/core'
import { FC } from 'react'
import InfoIcon from '@material-ui/icons/InfoOutlined'

interface Props extends BoxProps {
  label: string
  tooltip?: string
  labelVariant?: TypographyVariant
}

const LabelWithTooltip: FC<Props> = ({ label, tooltip, labelVariant, ...props }: Props) => {
  return (
    <Box display="flex" alignItems="center" {...props}>
      <Typography variant={labelVariant} color="textSecondary">
        {label}
      </Typography>
      {tooltip && (
        <Box clone fontSize={10} ml={0.5}>
          <Tooltip title={tooltip}>
            <InfoIcon fontSize="small" data-testid="info-icon" />
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}

export default LabelWithTooltip
