import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { AvisosProvider } from './components/Avisos.jsx';
import Login from './pages/Login.jsx';
import Agenda from './pages/Agenda.jsx';

/** Só deixa passar quem está logado; os outros vão para a tela de entrada. */
function Protegida({ children }) {
  const { usuario, verificando } = useAuth();
  if (verificando) return <p className="px-6 py-20 text-center text-suave">Carregando...</p>;
  return usuario ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Protegida>
                  <Agenda />
                </Protegida>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
