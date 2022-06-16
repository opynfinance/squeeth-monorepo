import { createStyles, makeStyles } from '@material-ui/core/styles'
import Box from '@material-ui/core/Box'
import NorthEastOutlinedIcon from '@material-ui/icons/CallMade'
import Link from 'next/link'
import { useRouter } from 'next/router'

const useStyles = makeStyles(() =>
  createStyles({
    restrictedInfo: {
      margin: '1em auto 1em',
      width: '90%',
      maxWidth: '350px',
      background: '#181B1C',
      padding: '1em',
      borderRadius: 15,
      boxShadow: '5px 3px 32px -6px rgba(14,103,112,0.56)',
    },
    icon: {
      fontSize: '10px',
    },
  }),
)

const restrictedCountries: Record<string, string> = {
  US: 'the United States',
  BY: 'Belarus',
  CU: 'Cuba',
  IR: 'Iran',
  IQ: 'Iraq',
  CI: `Cote d'Ivoire`,
  LR: 'Liberia',
  KP: 'North Korea',
  SD: 'Sudan',
  SY: 'Syria',
  ZW: 'Zimbabwe',
}

const RestrictionInfo = () => {
  const classes = useStyles()
  const router = useRouter()
  const userLocation = router.query?.ct
  return (
    <Box className={classes.restrictedInfo}>
      <p>
        <span>
          This app is not available in {userLocation ? restrictedCountries[String(userLocation)] : 'your country'}. More
          details can be found in our
        </span>
        <Link href="/terms-of-service">
          <a target="_blank"> Terms of service. </a>
        </Link>
        <Link href="/terms-of-service">
          <a target="_blank">
            <NorthEastOutlinedIcon className={classes.icon} />
          </a>
        </Link>
      </p>
    </Box>
  )
}

export default RestrictionInfo
