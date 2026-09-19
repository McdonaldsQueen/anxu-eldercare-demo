import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_HOME } from '../data/mockData'
import type { Role } from '../domain/models'
import { useDemoStore } from '../store/demoStore'
import { ArrowIcon, ShieldHeartIcon } from '../components/ui/Icons'
import { LifePhotoWall } from '../components/landing/LifePhotoWall'

const roleEntries: Array<{
  role: Role
  title: string
  subtitle: string
}> = [
  { role: 'ELDER', title: '老人', subtitle: '有需要，直接说。' },
  { role: 'FAMILY', title: '家属', subtitle: '不必反复追问，也知道事情正在被处理。' },
  { role: 'STAFF', title: '工作人员', subtitle: '少一点琐碎，多一点真正面对人的时间。' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const setActiveRole = useDemoStore((state) => state.setActiveRole)
  const roleEntryRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  const explore = () => {
    roleEntryRef.current?.scrollIntoView({ block: 'start' })
    roleEntryRef.current?.focus({ preventScroll: true })
  }

  const enterAs = (role: Role) => {
    setActiveRole(role)
    navigate(ROLE_HOME[role])
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
              <button className="primary-button" type="button" onClick={() => enterAs('ELDER')}>
                开始体验
              </button>
              <button className="hero__explore" type="button" onClick={explore}>
                自由探索 <span aria-hidden="true">↓</span>
              </button>
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
              <button key={role} className="role-entry-card" type="button" onClick={() => enterAs(role)}>
                <span><strong>{title}</strong><small>{subtitle}</small></span>
                <ArrowIcon className="role-entry-card__arrow" />
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer"><span>安序智护</span><span>产品概念演示 · 服务流程与人物信息为模拟数据</span></footer>
    </div>
  )
}
