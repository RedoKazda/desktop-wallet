/*
Copyright 2018 - 2023 The Alephium Authors
This file is part of the alephium project.

The library is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

The library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with the library. If not, see <http://www.gnu.org/licenses/>.
*/

import { SignUnsignedTxResult, transactionSign } from '@alephium/web3'
import { usePostHog } from 'posthog-js/react'
import { useTranslation } from 'react-i18next'

import { SignUnsignedTxData } from '@/types/transactions'
import client from '@/api/client'
import { useCallback, useEffect, useState } from 'react'
import { useWalletConnectContext } from '@/contexts/walletconnect'
import { getSdkError } from '@walletconnect/utils'
import CenteredModal, { ModalContent } from '@/modals/CenteredModal'
import { InputFieldsColumn } from '@/components/InputFieldsColumn'
import InfoBox from '@/components/InfoBox'
import FooterButton from '@/components/Buttons/FooterButton'
import { getHumanReadableError } from '@alephium/sdk'
import { WALLETCONNECT_ERRORS } from '@/utils/constants'

interface SignUnsignedTxModalProps {
  onClose: () => void
  txData: SignUnsignedTxData
}

const SignUnsignedTxModal = ({ onClose, txData }: SignUnsignedTxModalProps) => {
  const { t } = useTranslation()
  const { requestEvent, onSessionRequestError, onSessionRequestSuccess } = useWalletConnectContext()
  const posthog = usePostHog()
  const [isLoading, setIsLoading] = useState(false)
  const [decodedUnsignedTx, setDecodedUnsignedTx] = useState<Omit<SignUnsignedTxResult, 'signature'> | undefined>(undefined)

  const decodeUnsignedTx = useCallback(async () => {
    const decodedResult = await client.node.transactions.postTransactionsDecodeUnsignedTx({ unsignedTx: txData.unsignedTx })

    return {
      txId: decodedResult.unsignedTx.txId,
      fromGroup: decodedResult.fromGroup,
      toGroup: decodedResult.toGroup,
      unsignedTx: txData.unsignedTx,
      gasAmount: decodedResult.unsignedTx.gasAmount,
      gasPrice: BigInt(decodedResult.unsignedTx.gasPrice)
    }
  }, [txData.unsignedTx])

  useEffect(() => {
    setIsLoading(true)
    decodeUnsignedTx().then((result) => {
      setDecodedUnsignedTx(result)
      setIsLoading(false)
    })
  }, [txData.unsignedTx])

  const handleSign = async () => {
    if (!decodedUnsignedTx || !requestEvent) return

    try {
      const signature = transactionSign(decodedUnsignedTx.unsignedTx, txData.fromAddress.privateKey)
      const signResult: SignUnsignedTxResult = { signature, ...decodedUnsignedTx }
      await onSessionRequestSuccess(requestEvent, signResult)
    } catch (e) {
      posthog.capture('Error', { message: 'Could not sign unsigned tx' })

      if (requestEvent) {
        onSessionRequestError(requestEvent, {
          message: getHumanReadableError(e, 'Error while signing unsigned tx'),
          code: WALLETCONNECT_ERRORS.TRANSACTION_SIGN_FAILED
        })
      }
    }
  }

  const onCloseExtended = useCallback(() => {
    onClose()

    if (requestEvent) onSessionRequestError(requestEvent, getSdkError('USER_REJECTED_EVENTS'))
  }, [onClose, requestEvent, onSessionRequestError])

  return (
    <CenteredModal
      title={"Sign Unsigned Tx"}
      onClose={onCloseExtended}
      isLoading={isLoading}
      dynamicContent
      focusMode
      noPadding
    >
      {
        decodedUnsignedTx ? (
          <ModalContent>
            <InputFieldsColumn>
              <InfoBox label={'Transaction Id'} text={decodedUnsignedTx.txId} wordBreak />
              <InfoBox label={'Unsigned Transaction'} text={decodedUnsignedTx.unsignedTx} wordBreak />
            </InputFieldsColumn>
            <FooterButton
              onClick={() => handleSign()}
              disabled={isLoading || !decodedUnsignedTx}
            >
              {t('Sign')}
            </FooterButton>

          </ModalContent>
        ) : null
      }
    </CenteredModal>
  )
}

export default SignUnsignedTxModal
