import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldHeartIcon } from '../ui/Icons'
import { ResetDemo } from './ResetDemo'
import { RoleSwitcher } from './RoleSwitcher'

interface AppShellProps {
  children: ReactNode
  pageClassName?: string
}

export function AppShell({ children, pageClassName = '' }: AppShellProps) {
  return (
    <div className={`app-page ${pageClassName}`}>
      <header className="app-header">
        <Link className="brand brand--compact" to="/" aria-label="返回安序智护开场页">
          <span className="brand__mark">
            <ShieldHeartIcon />
          </span>
          <span>安序智护</span>
        </Link>
        <RoleSwitcher />
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <span>产品概念演示 · 页面信息均为 Mock Data</span>
        <ResetDemo />
      </footer>
    </div>
  )
}
