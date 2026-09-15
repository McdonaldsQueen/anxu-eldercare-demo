import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../../store/demoStore'

export function ResetDemo() {
  const [isConfirming, setIsConfirming] = useState(false)
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const navigate = useNavigate()

  const confirmReset = () => {
    resetDemo()
    setIsConfirming(false)
    navigate('/')
  }

  if (isConfirming) {
    return (
      <div className="reset-confirm" role="group" aria-label="确认重置 Case 演示">
        <span>重置 Mock Case？</span>
        <button type="button" onClick={() => setIsConfirming(false)}>
          取消
        </button>
        <button type="button" className="reset-confirm__action" onClick={confirmReset}>
          确认重置
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="reset-link"
      onClick={() => setIsConfirming(true)}
    >
      重置 Case 演示
    </button>
  )
}
