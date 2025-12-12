import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ResumoPage } from './pages/ResumoPage';
import { FaturamentoPage } from './pages/FaturamentoPage';
import { MarketingPage } from './pages/MarketingPage';
import { ComercialPage } from './pages/ComercialPage';
import { AtendimentoPage } from './pages/AtendimentoPage';
import { AdministrativoPage } from './pages/AdministrativoPage';
import { MetasPage } from './pages/MetasPage';
import { PacientesPage } from './pages/PacientesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ResumoPage />} />
          <Route path="faturamento" element={<FaturamentoPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="comercial" element={<ComercialPage />} />
          <Route path="atendimento" element={<AtendimentoPage />} />
          <Route path="administrativo" element={<AdministrativoPage />} />
          <Route path="metas" element={<MetasPage />} />
          <Route path="pacientes" element={<PacientesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
