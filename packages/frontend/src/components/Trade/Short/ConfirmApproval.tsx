import { useState } from 'react'
import Button from '@material-ui/core/Button'
import FormControlLabel from '@material-ui/core/FormControlLabel'
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
      >
        <ul style={{ width: '90%', alignSelf: 'flex-start' }}>
          <li style={{ marginBottom: '2em' }}>
            When you open a short position, the wrapper maximizes capital efficiency by using ETH earned from selling
            oSQTH as collaterl back the vault.
          </li>
          <li style={{ marginBottom: '2em' }}>
            When you close a short position, the wrapper maximizes capital efficiency by using collateral from your
            vault to buy back and burn oSQTH
          </li>
          <li style={{ marginBottom: '2em' }}>
            {`When you open or close a short position, you are adjusting the vault's collateralization ratio, not the
            collateralization ratio for the trade.`}
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
            label="I understand these of changes"
          />
        </ul>
        <Button
          classes={{ disabled: classes.disabledButton, ...(!checked ? { label: classes.label } : {}) }}
          disabled={!checked}
          style={{ width: '90%', background: '#d9d9d9' }}
          onClick={handleConfirmApproval}
          id="confirm-approval-modal-submit-btn"
        >
          Confirm Approval
        </Button>
      </Modal>
    </>
  )
}
export default ConfirmApproval
