import { useLayoutEffect, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import type { Role } from '../domain/models'
import { ElderHomePage } from '../pages/ElderHomePage'
import { CaseDetailPage } from '../pages/CaseDetailPage'
import { FamilyHomePage } from '../pages/FamilyHomePage'
import { FamilyPortalPage } from '../pages/FamilyPortalPage'
import { LandingPage } from '../pages/LandingPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StaffWorkbenchPage } from '../pages/StaffWorkbenchPage'
import { StaffTaskDetailPage } from '../pages/StaffTaskDetailPage'
import { StaffElderDetailPage } from '../pages/StaffElderDetailPage'
import { StaffElderListPage } from '../pages/StaffElderListPage'
import { useDemoStore } from '../store/demoStore'

function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const setActiveRole = useDemoStore((state) => state.setActiveRole)

  useLayoutEffect(() => {
    setActiveRole(role)
  }, [role, setActiveRole])

  return children
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/elder" element={<RoleRoute role="ELDER"><ElderHomePage /></RoleRoute>} />
        <Route path="/elder/cases/:caseId" element={<RoleRoute role="ELDER"><CaseDetailPage role="ELDER" /></RoleRoute>} />
        <Route path="/family" element={<RoleRoute role="FAMILY"><FamilyPortalPage /></RoleRoute>} />
        <Route path="/family/elders/:elderId" element={<RoleRoute role="FAMILY"><FamilyHomePage /></RoleRoute>} />
        <Route path="/family/cases/:caseId" element={<RoleRoute role="FAMILY"><CaseDetailPage role="FAMILY" /></RoleRoute>} />
        <Route path="/staff" element={<RoleRoute role="STAFF"><StaffWorkbenchPage /></RoleRoute>} />
        <Route path="/staff/elders" element={<RoleRoute role="STAFF"><StaffElderListPage /></RoleRoute>} />
        <Route path="/staff/elders/:elderId" element={<RoleRoute role="STAFF"><StaffElderDetailPage /></RoleRoute>} />
        <Route path="/staff/tasks/:caseId" element={<RoleRoute role="STAFF"><StaffTaskDetailPage /></RoleRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  )
}
