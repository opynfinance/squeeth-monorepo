import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Typography, BoxProps } from '@material-ui/core'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'

import Alert from './Alert'
import { useRestrictUser } from '@context/restrict-user'

const useStyles = makeStyles(() =>
  createStyles({
    text: { fontWeight: 500, fontSize: '15px', color: '#fff' },
    link: { textDecoration: 'underline' },
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
  CA: 'Canada',
}

type RestrictionInfoProps = BoxProps & { withdrawAllowed?: boolean }

const RestrictionInfo: React.FC<RestrictionInfoProps> = (props) => {
  const classes = useStyles()
  const router = useRouter()
  const userLocation = router.query?.ct
  const { isBlockedUser } = useRestrictUser()

  return (
    <Alert severity="warning" showIcon={false} {...props}>
      <Typography className={classes.text}>
        {isBlockedUser
          ? 'Your account is blocked because you violated our Terms of service. Withdrawals are still available.'
          : `This app is not available in ${
              userLocation ? restrictedCountries[String(userLocation)] : 'your country'
            }. ${
              props.withdrawAllowed ? 'Only withdrawals are still available.' : null
            } More details can be found in our `}

        <Typography className={clsx(classes.text, classes.link)} component="span">
          <Link href="/terms-of-service">
            <a target="_blank"> Terms of service. </a>
          </Link>
        </Typography>
      </Typography>
    </Alert>
  )
}

export default RestrictionInfo
