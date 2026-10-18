import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useAuth } from "./auth";
import { Ask } from "./pages/Ask";
import { Dashboard } from "./pages/Dashboard";
import { Files } from "./pages/Files";
import { Projects } from "./pages/Projects";
import { Team } from "./pages/Team";
import { SignIn, Splash } from "./pages/SignIn";

export function App() {
  const { session } = useAuth();
  if (session.status === "loading") return <Splash />;
  if (session.status === "signed-out") return <SignIn />;
  if (session.status === "unregistered") return <SignIn pendingEmail={session.email} />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Projects />} />
        <Route path="team" element={<Team />} />
        <Route path="projects/:projectId">
          <Route index element={<Navigate to="files" replace />} />
          <Route path="ask" element={<Ask />} />
          <Route path="files" element={<Files />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
