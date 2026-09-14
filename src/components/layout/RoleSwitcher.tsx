import { useNavigate } from 'react-router-dom'
import { ROLE_HOME, ROLE_LABELS } from '../../data/mockData'
import type { Role } from '../../domain/models'
import { useDemoStore } from '../../store/demoStore'

export function RoleSwitcher() {
  const activeRole = useDemoStore((state) => state.activeRole)
  const setActiveRole = useDemoStore((state) => state.setActiveRole)
  const navigate = useNavigate()

  const handleChange = (role: Role) => {
    setActiveRole(role)
    navigate(ROLE_HOME[role])
  }

  return (
    <label className="role-switcher">
      <span>当前体验</span>
      <select
        aria-label="切换体验身份"
        value={activeRole}
        onChange={(event) => handleChange(event.target.value as Role)}
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </label>
  )
}
