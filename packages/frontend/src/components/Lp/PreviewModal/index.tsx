import React, { useState, useCallback } from 'react'

import ModalBase from '@components/Modal/ModalBase'
import LPSettings from './LPSettings'
import WaitForConfirmation from './WaitForConfirmation'
import { TxStatusSuccess, TxStatusFail } from './TxStatus'

enum Step {
  CustomizeLPSettings,
  WaitForConfirmation,
  TxStatus,
}

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  ethToDeposit: string
  setETHToDeposit: React.Dispatch<React.SetStateAction<string>>
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, ethToDeposit, setETHToDeposit }) => {
  const [activeStep, setActiveStep] = useState<Step>(Step.CustomizeLPSettings)
  const [txError, setTxError] = useState('')

  const resetAndGoToStart = useCallback(() => {
    setTxError('')
    setActiveStep(Step.CustomizeLPSettings)
  }, [])

  const handleTxFail = useCallback((message: string) => {
    setTxError(message)
    setActiveStep(Step.TxStatus)
  }, [])

  const handleClose = useCallback(() => {
    resetAndGoToStart()
    onClose()
  }, [onClose, resetAndGoToStart])

  return (
    <ModalBase open={isOpen} onClose={handleClose} aria-labelledby="modal-title">
      <>
        {activeStep === Step.CustomizeLPSettings && (
          <LPSettings
            ethToDeposit={ethToDeposit}
            setETHToDeposit={setETHToDeposit}
            onConfirm={() => setActiveStep(Step.WaitForConfirmation)}
            onTxSuccess={() => setActiveStep(Step.TxStatus)}
            onTxFail={(message) => handleTxFail(message)}
          />
        )}

        {activeStep === Step.WaitForConfirmation && <WaitForConfirmation />}
        {activeStep === Step.TxStatus &&
          (txError === '' ? (
            <TxStatusSuccess onComplete={handleClose} />
          ) : (
            <TxStatusFail message={txError} onBackClick={resetAndGoToStart} />
          ))}
      </>
    </ModalBase>
  )
}

export default PreviewModal
