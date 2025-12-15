import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { ResumoPage } from './pages/ResumoPage';
import { FaturamentoPage } from './pages/FaturamentoPage';
import { MarketingPage } from './pages/MarketingPage';
import { ComercialPage } from './pages/ComercialPage';
import { AtendimentoPage } from './pages/AtendimentoPage';
import { MetasPage } from './pages/MetasPage';
import { PacientesPage } from './pages/PacientesPage';
import { MetaAdsConfigPage } from './pages/MetaAdsConfigPage';
import { ComoFuncionaPage } from './pages/ComoFuncionaPage';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<ResumoPage />} />
              <Route path="faturamento" element={<FaturamentoPage />} />
              <Route path="marketing" element={<MarketingPage />} />
              <Route path="comercial" element={<ComercialPage />} />
              <Route path="atendimento" element={<AtendimentoPage />} />
              <Route path="metas" element={<MetasPage />} />
              <Route path="pacientes" element={<PacientesPage />} />
              <Route path="config/meta-ads" element={<MetaAdsConfigPage />} />
              <Route path="como-funciona" element={<ComoFuncionaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
