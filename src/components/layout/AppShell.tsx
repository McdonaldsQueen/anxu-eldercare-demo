import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldHeartIcon } from '../ui/Icons'
import { DemoToolbar } from './DemoToolbar'
import { RoleSwitcher } from './RoleSwitcher'

interface AppShellProps {
  children: ReactNode
  pageClassName?: string
}

export function AppShell({ children, pageClassName = '' }: AppShellProps) {
  return (
    <div className={`app-page ${pageClassName}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="app-header">
        <Link className="brand brand--compact" to="/" aria-label="返回安序智护开场页">
          <span className="brand__mark">
            <ShieldHeartIcon />
          </span>
          <span>安序智护</span>
        </Link>
        <RoleSwitcher />
      </header>
      <main className="app-main" id="main-content">{children}</main>
      <DemoToolbar />
      <footer className="app-footer">
        <span>产品概念演示 · OpenHex 提供真实对话 · Case 与服务流程使用 Mock Data</span>
      </footer>
    </div>
  )
}
