import React, { useState } from 'react'
import { Box, InputLabel, TextField, TextFieldProps, Typography } from '@material-ui/core'
import clsx from 'clsx'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import NextRebalanceTimer from './NextRebalanceTimer'
import ProfitabilityChart from './ProfitabilityChart'
import AdvancedMetrics from './AdvancedMetrics'
import useStyles from '@components/Strategies/styles'
import { LinkWrapper } from '@components/LinkWrapper'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'
import { DateTimePicker, MuiPickersUtilsProvider } from '@material-ui/pickers'
import DateFnsUtils from '@date-io/date-fns'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { addressAtom } from '@state/wallet/atoms'
import { firstDepositBlockAtom, firstDepositTimeAtom } from '@state/crab/atoms'

const useTextFieldStyles = makeStyles((theme) =>
  createStyles({
    labelRoot: {
      color: '#8C8D8D',
      fontSize: '14px',
      fontWeight: 500,
    },
    inputRoot: {
      padding: '10px 16px',
      fontSize: '15px',
      fontWeight: 500,
      fontFamily: 'DM Mono',
      width: '22ch',
      border: '2px solid #303436',
      borderRadius: '12px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
  }),
)

const CustomTextField: React.FC<TextFieldProps> = ({ inputRef, label, InputProps, id, variant, ...props }) => {
  const classes = useTextFieldStyles()

  return (
    <Box display="flex" flexDirection="column" gridGap="4px">
      <InputLabel htmlFor={id} classes={{ root: classes.labelRoot }}>
        {label}
      </InputLabel>
      <TextField
        id={id}
        InputProps={{
          classes: {
            root: classes.inputRoot,
            focused: classes.inputFocused,
          },
          disableUnderline: true,
          ...InputProps,
        }}
        {...props}
      />
    </Box>
  )
}

const useAboutStyles = makeStyles((theme) =>
  createStyles({
    timerContainer: {
      position: 'absolute',
      top: '10px',
      right: '0',
      zIndex: 200,

      [theme.breakpoints.down('sm')]: {
        position: 'relative',
        top: '0px',
        right: '0',
        marginBottom: '16px',
      },
    },
    dateContainer: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '16px',
      height: '40px',
    },
    label: {
      fontSize: '15px',
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: 500,
      textAlign: 'right',
    },
  }),
)
const gitBookLink = 'https://opyn.gitbook.io/opyn-strategies/crab-strategy/introduction'

const DepositTimePicker: React.FC = () => {
  const aboutClasses = useAboutStyles()
  const [depositTime, setDepositTime] = useAtom(firstDepositTimeAtom)
  const setDepositBlock = useSetAtom(firstDepositBlockAtom)
  const [date, setDate] = useState(new Date(depositTime ? depositTime * 1000 : Date.now()))

  const onDepositDateChange = async (date: Date | null) => {
    if (date) {
      setDate(date)
      setDepositTime(date.getTime() / 1000)
      const resp = await fetch(`/api/getBlockNumber?timestamp=${date.getTime() / 1000}`)
      const data = await resp.json()
      console.log(data)
      setDepositBlock(data.blockNumber)
    }
  }

  return (
    <div>
      <Typography className={aboutClasses.label}>Deposit date</Typography>
      <MuiPickersUtilsProvider utils={DateFnsUtils}>
        <DateTimePicker
          fullWidth
          value={date}
          onChange={onDepositDateChange}
          DialogProps={{ disableScrollLock: true }}
          TextFieldComponent={CustomTextField}
          format={'MM/dd/yy HH:mm a'}
          maxDate={new Date()}
        />
      </MuiPickersUtilsProvider>
    </div>
  )
}

const About: React.FC = () => {
  const classes = useStyles()
  const aboutClasses = useAboutStyles()
  const { track } = useAmplitude()

  const address = useAtomValue(addressAtom)

  return (
    <div>
      <Box display="flex" flexDirection="column" gridGap="8px">
        <Typography variant="h3" className={classes.sectionTitle}>
          About Crab
        </Typography>
        <Typography variant="h2" className={classes.heading}>
          Stack USDC when ETH is calm
        </Typography>

        <Typography className={clsx(classes.text, classes.textMargin)}>
          In general, Crab earns USDC returns except when there is high ETH volatility in the market, when it may draw
          down. Most often, the strategy stacks USDC if ETH is within the below bands at the next hedge.{' '}
          <LinkWrapper
            href={gitBookLink}
            onClick={() => track(SITE_EVENTS.CLICK_LEARN_MORE_CRAB, { link: gitBookLink })}
          >
            Learn more
          </LinkWrapper>
        </Typography>
      </Box>

      <Box position="relative" marginTop="32px">
        <div className={aboutClasses.timerContainer}>
          <DepositTimePicker />
          <NextRebalanceTimer />
        </div>
        <ProfitabilityChart />
      </Box>

      <Box marginTop="16px">
        <AdvancedMetrics />
      </Box>
    </div>
  )
}

export default About
