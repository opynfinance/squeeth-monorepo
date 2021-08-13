import Typography from '@material-ui/core/Typography'
import Box from '@material-ui/core/Box'
import { createStyles, makeStyles } from '@material-ui/core'
import Nav from '../src/components/Nav'

const useStyles = makeStyles(theme => (createStyles({
  header: {
    color: theme.palette.primary.main,
  }
})))

export default function Vault() {
  const classes = useStyles();

  return (
    <div>
      <Nav />
      <div>
        Vaults
      </div>
    </div>
  )
}
