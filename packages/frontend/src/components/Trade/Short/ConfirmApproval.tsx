import { useState } from 'react'
import Button from '@material-ui/core/Button'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import LockOpenIcon from '@material-ui/icons/LockOpen'
import LockOutlinedIcon from '@material-ui/icons/LockOutlined'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import Checkbox from '@material-ui/core/Checkbox'
import { createStyles, makeStyles } from '@material-ui/core'

import { Modal } from '../../Modal/Modal'

const useStyles = makeStyles(() =>
  createStyles({
    disabledButton: {
      cursor: 'not-allowed',
    },
    label: {
      color: 'rgba(0, 0, 0, 0.5)',
    },
    subTopics: {
      color: '#2ce6f9',
      margin: 0.5,
      fontSize: '1rem',
      fontWeight: 'bold',
      marginTop: ' .5em',
    },
    subHeaderSection: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
  }),
)
const ConfirmApproval = ({
  openConfirm,
  title,
  handleClose,
  handleConfirmApproval,
}: {
  openConfirm: boolean
  title: string
  handleClose: () => void
  handleConfirmApproval: () => void
}) => {
  const classes = useStyles()
  const [checked, setCheck] = useState(false)
  return (
    <>
      <Modal
        id="confirm-approval-modal"
        open={openConfirm}
        handleClose={handleClose}
        title={title}
        showCloseButton={false}
        buttonComp={
          <Button
            classes={{ disabled: classes.disabledButton, ...(!checked ? { label: classes.label } : {}) }}
            disabled={!checked}
            style={{ width: '90%', background: '#d9d9d9', margin: '0 auto', marginBottom: '2rem' }}
            onClick={handleConfirmApproval}
            id="confirm-approval-modal-submit-btn"
          >
            Approve and get Squeethy!
          </Button>
        }
      >
        <ul style={{ width: '90%', alignSelf: 'flex-start', listStyle: 'none' }}>
          <li style={{ marginBottom: '1.5rem' }}>
            <div className={classes.subHeaderSection}>
              <LockOpenIcon fontSize="large" />
              <p className={classes.subTopics}>OPEN SHORT</p>
            </div>
            <p style={{ margin: 0, textAlign: 'center' }}>
              When you open a short position, the wrapper maximizes capital efficiency by using ETH earned from selling
              oSQTH as collateral back the vault.
            </p>
          </li>
          <li style={{ marginBottom: '1.5rem' }}>
            <div className={classes.subHeaderSection}>
              <LockOutlinedIcon fontSize="large" />
              <p className={classes.subTopics}>CLOSE SHORT</p>
            </div>
            <p style={{ margin: 0, textAlign: 'center' }}>
              When you close a short position, the wrapper maximizes capital efficiency by using collateral from your
              vault to buy back and burn oSQTH
            </p>
          </li>
          <li style={{ marginBottom: '1.5rem' }}>
            <div className={classes.subHeaderSection}>
              <AccountBalanceIcon fontSize="large" />
              <p className={classes.subTopics}>VAULT COLLATERALIZATION RATIO</p>
            </div>
            <p style={{ margin: 0, textAlign: 'center' }}>
              When you open or close a short position, you are adjusting the vault&#39;s collateralization ratio, not
              the collateralization ratio for the trade.
            </p>
          </li>

          <FormControlLabel
            style={{ fontSize: '.75rem' }}
            control={
              <Checkbox
                id="confirm-approval-check-box"
                name="checkedC"
                checked={checked}
                onChange={() => setCheck((prevState) => !prevState)}
              />
            }
            label="Makes sense to me, let's squeeth!"
          />
        </ul>
      </Modal>
    </>
  )
}
export default ConfirmApproval
