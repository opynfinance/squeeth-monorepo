import { Box, BoxProps } from '@material-ui/core'

export type TextVariant = 'H2' | 'H3' | 'H4' | 'LabelL'

interface Props extends BoxProps {
  variant: TextVariant
}

export default function Text({ variant, ...props }: Props) {
  if (variant === 'H2') {
    return <Box fontSize={24} fontWeight={700} {...props} />
  }

  if (variant === 'H3') {
    return <Box fontSize={20} fontWeight={700} {...props} />
  }

  if (variant === 'H4') {
    return <Box fontSize={18} fontWeight={700} {...props} />
  }

  if (variant === 'LabelL') {
    return <Box fontSize={15} fontWeight={600} {...props} />
  }

  return null
}
