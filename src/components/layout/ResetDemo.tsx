import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resetEntireDemo } from '../../services/demoReset'

export function ResetDemo() {
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const navigate = useNavigate()

  const confirmReset = async () => {
    if (resetting) return
    setResetting(true)
    await resetEntireDemo()
    navigate('/', { replace: true })
  }

  if (confirming) {
    return (
      <div className="reset-confirm" role="group" aria-label="确认重置演示">
        <span>重置后将清除当前对话、工单和演示进度，并恢复初始状态。</span>
        <button type="button" disabled={resetting} onClick={() => setConfirming(false)}>
          取消
        </button>
        <button type="button" className="reset-confirm__action" disabled={resetting} onClick={() => void confirmReset()}>
          {resetting ? '重置中…' : '确认重置'}
        </button>
      </div>
    )
  }

  return (
    <div className="reset-actions">
      <button type="button" className="reset-link" onClick={() => setConfirming(true)}>重置演示</button>
    </div>
  )
}
