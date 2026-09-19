import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../../store/demoStore'

export function ResetDemo() {
  const [confirmMode, setConfirmMode] = useState<'STANDARD' | 'GOLDEN' | null>(null)
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const resetGoldenPathDemo = useDemoStore((state) => state.resetGoldenPathDemo)
  const navigate = useNavigate()

  const confirmReset = () => {
    if (confirmMode === 'GOLDEN') {
      resetGoldenPathDemo()
      setConfirmMode(null)
      navigate('/staff/elders')
      return
    }
    resetDemo()
    setConfirmMode(null)
    navigate('/')
  }

  if (confirmMode) {
    return (
      <div className="reset-confirm" role="group" aria-label={confirmMode === 'GOLDEN' ? '确认重置完整演示' : '确认重置 Case 演示'}>
        <span>{confirmMode === 'GOLDEN' ? '从绑定邀请开始完整演示？' : '重置 Mock Case？'}</span>
        <button type="button" onClick={() => setConfirmMode(null)}>
          取消
        </button>
        <button type="button" className="reset-confirm__action" onClick={confirmReset}>
          确认重置
        </button>
      </div>
    )
  }

  return (
    <div className="reset-actions">
      <button type="button" className="reset-link" onClick={() => setConfirmMode('STANDARD')}>重置 Case 演示</button>
      <button type="button" className="reset-link" onClick={() => setConfirmMode('GOLDEN')}>重置完整演示</button>
    </div>
  )
}
