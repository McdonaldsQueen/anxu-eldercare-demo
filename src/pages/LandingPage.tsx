import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_HOME } from '../data/mockData'
import type { Role } from '../domain/models'
import { ArrowIcon, ShieldHeartIcon } from '../components/ui/Icons'
import { LifePhotoWall } from '../components/landing/LifePhotoWall'

const roleEntries: Array<{
  role: Role
  title: string
  subtitle: string
}> = [
  { role: 'ELDER', title: '老人端', subtitle: '有需要，直接说。' },
  { role: 'FAMILY', title: '家属端', subtitle: '关心进展，也可以发起请求。' },
  { role: 'STAFF', title: '工作人员端', subtitle: '处理需求、风险和人工决策。' },
]

export function LandingPage() {
  const roleEntryRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  const explore = () => {
    roleEntryRef.current?.scrollIntoView({ block: 'start' })
    roleEntryRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        mainRef.current?.focus()
      }}>跳到主要内容</a>
      <header className="landing-nav">
        <div className="brand">
          <span className="brand__mark"><ShieldHeartIcon /></span>
          <span>安序智护</span>
        </div>
      </header>

      <main className="landing-main" id="main-content" ref={mainRef} tabIndex={-1}>
        <section className="hero" aria-labelledby="landing-title">
          <div className="hero__copy">
            <p className="hero__kicker">安序智护<span>AI 养老个案管理员</span></p>
            <h1 id="landing-title">需要帮助的时候，不应该被忘记。</h1>
            <p className="hero__description">
              从一句自然的表达开始，安序智护会记住这件事，并一直跟下去。
            </p>
            <p className="hero__value">让技术负责记住，让人负责关心。</p>
            <div className="hero__actions">
              <button className="primary-button" type="button" onClick={explore}>选择体验入口 <span aria-hidden="true">↓</span></button>
            </div>
          </div>
        </section>

        <LifePhotoWall />

        <section className="landing-reflection" aria-labelledby="care-time-title">
          <h2 id="care-time-title">AI 不替代照护者，它让人的时间重新回到人身上。</h2>
        </section>

        <section className="role-entry-section" aria-labelledby="role-entry-title" ref={roleEntryRef} tabIndex={-1}>
          <div className="section-heading">
            <h2 id="role-entry-title">从不同的人眼里，看同一份关心。</h2>
          </div>
          <div className="role-entry-grid">
            {roleEntries.map(({ role, title, subtitle }) => (
              <Link key={role} className="role-entry-card" to={ROLE_HOME[role]}>
                <span><strong>{title}</strong><small>{subtitle}</small></span>
                <ArrowIcon className="role-entry-card__arrow" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer"><span>安序智护</span><span>产品概念演示 · 服务流程与人物信息为模拟数据</span></footer>
    </div>
  )
}
