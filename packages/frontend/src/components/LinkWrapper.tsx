import { createStyles, makeStyles } from '@material-ui/core/styles'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'

const useStyles = makeStyles((theme) =>
  createStyles({
    linkWrap: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.palette.primary.main,
      gap: '3px',
      '&:hover': {
        opacity: '0.8',
        textDecoration: 'underline',
      },
    },
  }),
)

interface LinkWrapperProps {
  href: string
  onClick?: () => void
}

export const LinkWrapper: React.FC<LinkWrapperProps> = ({ href, children, onClick }) => {
  const classes = useStyles()
  return (
    <a className={classes.linkWrap} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      {children}
      <OpenInNewIcon style={{ width: '13px' }} />
    </a>
  )
}
