import { Link } from 'react-router-dom'
import { ShieldHeartIcon } from '../components/ui/Icons'

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span className="brand__mark"><ShieldHeartIcon /></span>
      <p className="eyebrow">页面没有找到</p>
      <h1>我们带您回到开始的地方</h1>
      <Link className="primary-button" to="/">返回开场页</Link>
    </main>
  )
}
