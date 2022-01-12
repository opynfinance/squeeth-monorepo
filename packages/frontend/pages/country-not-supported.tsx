import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'

import { useRestrictUser } from '@context/restrict-user'
import { Modal } from '../src/components/Modal/Modal'

const App = () => {
  const router = useRouter()
  const { handleRestrictUser, isRestricted } = useRestrictUser()
  const [open] = useState(true)
  const [cookies, setCookie] = useCookies(['restriction'])

  useEffect(() => {
    handleRestrictUser(true)
  }, [handleRestrictUser])

  useEffect(() => {
    if (isRestricted) {
      setCookie('restriction', 'isRestricted', { path: '/' })
      setTimeout(() => {
        router.push('/')
      }, 3000)
    }
  }, [isRestricted, router])

  return (
    <>
      <Modal open={open} title="">
        <div style={{ padding: '0 1em' }}>
          <h1 style={{ textAlign: 'center', fontSize: '1.5rem' }}>Country Not supported</h1>
          <p>Unfortunately, this app is not supported in your region. </p>
        </div>
      </Modal>
    </>
  )
}

export default App
