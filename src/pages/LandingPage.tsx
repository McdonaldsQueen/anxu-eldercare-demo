import { useNavigate } from 'react-router-dom'
import { ROLE_HOME } from '../data/mockData'
import type { Role } from '../domain/models'
import { useDemoStore } from '../store/demoStore'
import {
  ArrowIcon,
  ClipboardIcon,
  ShieldHeartIcon,
  SparkIcon,
  UsersIcon,
} from '../components/ui/Icons'

const roleEntries: Array<{
  role: Role
  title: string
  subtitle: string
  icon: typeof UsersIcon
}> = [
  { role: 'ELDER', title: '老人视角', subtitle: '说出需要，安心等待', icon: SparkIcon },
  { role: 'FAMILY', title: '家属视角', subtitle: '随时知道，放心照护', icon: UsersIcon },
  { role: 'STAFF', title: '服务人员视角', subtitle: '清楚接单，持续推进', icon: ClipboardIcon },
]

export function LandingPage() {
  const navigate = useNavigate()
  const setActiveRole = useDemoStore((state) => state.setActiveRole)

  const enterAs = (role: Role) => {
    setActiveRole(role)
    navigate(ROLE_HOME[role])
  }

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="landing-nav">
        <div className="brand">
          <span className="brand__mark"><ShieldHeartIcon /></span>
          <span>安序智护</span>
        </div>
        <span className="mock-pill">产品概念 Demo</span>
      </header>

      <main className="landing-main" id="main-content">
        <section className="hero">
          <div className="hero__copy">
            <p className="hero__kicker"><SparkIcon /> 把每一份需要，接住并办下去</p>
            <h1>能听懂需求，也能把事情<span>办下去</span>的养老服务数字员工</h1>
            <p className="hero__description">
              从老人一句自然语言开始，理解需求、协调服务、同步家属，并持续跟进到事情解决。
            </p>
            <div className="hero__trust" aria-label="产品能力摘要">
              <span>真实 Agent 对话</span>
              <span>三角色进度同步</span>
              <span>安全事件人工确认</span>
            </div>
            <button className="primary-button" type="button" onClick={() => enterAs('ELDER')}>
              开始完整体验 <ArrowIcon />
            </button>
          </div>

          <div className="hero-journey" aria-label="安序智护服务流程">
            <div className="journey-orbit journey-orbit--one" />
            <div className="journey-orbit journey-orbit--two" />
            <div className="journey-core"><ShieldHeartIcon /></div>
            <div className="journey-step journey-step--one"><span>01</span>听懂需求</div>
            <div className="journey-step journey-step--two"><span>02</span>协调服务</div>
            <div className="journey-step journey-step--three"><span>03</span>同步进度</div>
            <div className="journey-step journey-step--four"><span>04</span>持续跟进</div>
          </div>
        </section>

        <section className="role-entry-section" aria-labelledby="role-entry-title">
          <div className="section-heading">
            <p className="eyebrow">从不同视角，看见同一件事</p>
            <h2 id="role-entry-title">选择体验身份</h2>
          </div>
          <div className="role-entry-grid">
            {roleEntries.map(({ role, title, subtitle, icon: Icon }) => (
              <button key={role} className="role-entry-card" type="button" onClick={() => enterAs(role)}>
                <span className="role-entry-card__icon"><Icon /></span>
                <span><strong>{title}</strong><small>{subtitle}</small></span>
                <ArrowIcon className="role-entry-card__arrow" />
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">产品概念演示 · 对话由 OpenHex Agent 提供 · Case 与服务信息为 Mock Data</footer>
    </div>
  )
}
