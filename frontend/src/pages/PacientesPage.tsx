import { DataTable } from '../components/dashboard/DataTable';
import { useDashboard } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/format';
import { PageSkeleton, RevalidatingIndicator } from '../components/ui/Skeleton';

// Mock data
const mockFaturamentoPaciente = [
  { cliente: 'LAURA PAULINO GARCIA', investimento: 1332944.79 },
  { cliente: 'GISLAYNE RAFAELA SCHEFFER', investimento: 768834.65 },
  { cliente: 'ANGLIZEY SOLIVAN DE OLIVEIRA', investimento: 582144.02 },
  { cliente: 'GLICIANE CHIARELLE DE SOUZA SCHEFFER', investimento: 535971.51 },
  { cliente: 'MIRNA APARECIDA STOCKER FRANZ', investimento: 497836.50 },
  { cliente: 'ROBERTA MARQUES DE CARVALHO RONDON', investimento: 468573.69 },
  { cliente: 'ROBERTA CARMO LAUDADIO DALTROZO', investimento: 467923.00 },
  { cliente: 'ALINE AMANDA HORM SCHEFFER', investimento: 444978.02 },
  { cliente: 'CELIO CORREA PINTO', investimento: 436638.86 },
  { cliente: 'ENEIAS VIEGAS DA SILVA', investimento: 428646.00 },
  { cliente: 'ELCIE KURAMOTI', investimento: 411399.01 },
  { cliente: 'KATIA REGINA KUNZE SCHNEIDER', investimento: 385427.00 },
  { cliente: 'ERIKA MARIA DA COSTA ABDALA TENUTA', investimento: 378046.72 },
  { cliente: 'JOABE OLIVEIRA QUEIROZ', investimento: 371294.34 },
  { cliente: 'ADRIANA SCHOTTEN WITTMANN', investimento: 366455.30 },
  { cliente: 'RAQUEL ALCHAAR SODRE MEURER', investimento: 351516.00 },
  { cliente: 'AURISTELA MARIA CAMPOS MIOTTO', investimento: 330354.00 },
  { cliente: 'JOARA DE O. MACHADO CASTRO', investimento: 316289.10 },
  { cliente: 'MARA DE CASTILHO VARJAO ANDRADE PIN...', investimento: 305872.00 },
];

const mockPotenciaisMais4Meses = [
  { cliente: 'MARY LEE SANTISTEBAN PINHEIRO', dias_sem_vir: 117, investimento: 16380.00 },
  { cliente: 'ALTAIR SOUZA RIBEIRO', dias_sem_vir: 116, investimento: 33130.00 },
  { cliente: 'LARISSA AZEVEDO SOUZA', dias_sem_vir: 113, investimento: 16351.00 },
  { cliente: 'JANE SELMA BARBOSA', dias_sem_vir: 112, investimento: 34495.00 },
  { cliente: 'FABIO CEZAR BARROS LEAO', dias_sem_vir: 111, investimento: 23400.00 },
  { cliente: 'EDUARDO ALENCAR DA SILVA', dias_sem_vir: 110, investimento: 23350.00 },
  { cliente: 'LEONICE LARA DE OLIVEIRA', dias_sem_vir: 109, investimento: 30900.00 },
  { cliente: 'ISABEL CRISTINA MALHEIROS', dias_sem_vir: 95, investimento: 19790.00 },
  { cliente: 'SELMA GUIMARAES SOUZA', dias_sem_vir: 89, investimento: 20285.00 },
  { cliente: 'JOYCE TAMARA BASTOS', dias_sem_vir: 82, investimento: 30402.00 },
  { cliente: 'JACKELINE DE SOUZA ALMEIDA S...', dias_sem_vir: 81, investimento: 16651.00 },
  { cliente: 'KAMILA CAMPOS PIRES', dias_sem_vir: 81, investimento: 28675.00 },
  { cliente: 'KARINY ALMEIDA PEREIRA DA SIL...', dias_sem_vir: 77, investimento: 32620.00 },
  { cliente: 'LETICIA LISBOA MACHADO', dias_sem_vir: 77, investimento: 27014.00 },
  { cliente: 'DANIELA MARQUES GODINHO', dias_sem_vir: 76, investimento: 22761.00 },
  { cliente: 'RAFAELA EMILIA BORTOLINI', dias_sem_vir: 75, investimento: 24280.00 },
  { cliente: 'FABIANA NELLI NOBREGA', dias_sem_vir: 74, investimento: 23192.01 },
  { cliente: 'PAULA CARINE BAGGIO', dias_sem_vir: 74, investimento: 21670.00 },
  { cliente: 'FLAVIA MARIA DE ABREU VIANA', dias_sem_vir: 71, investimento: 17950.00 },
];

export function PacientesPage() {
  const { data, loadingStates, revalidatingStates } = useDashboard();

  // Use specific loading state for pacientes
  const isLoading = loadingStates.pacientes;
  const isRevalidating = revalidatingStates.pacientes;

  const faturamentoColumns = [
    { key: 'cliente', header: 'Cliente', className: 'text-primary-400' },
    {
      key: 'investimento',
      header: 'Investimento (R$)',
      render: (v: string | number) => formatCurrency(Number(v)),
      className: 'text-primary-400 text-right',
      headerClassName: 'text-right',
    },
  ];

  const potenciaisColumns = [
    { key: 'cliente', header: 'Cliente', className: 'text-primary-400' },
    { key: 'dias_sem_vir', header: 'Dias sem vir', render: (v: string | number) => `${v} Dias`, className: 'text-primary-400 text-center', headerClassName: 'text-center' },
    {
      key: 'investimento',
      header: 'Investimento (R$)',
      render: (v: string | number) => formatCurrency(Number(v)),
      className: 'text-primary-400 text-right',
      headerClassName: 'text-right',
    },
  ];

  // Mostra skeleton enquanto carrega e não tem dados
  if (isLoading && !data.pacientes) {
    return (
      <div className="space-y-6">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with revalidating indicator */}
      <div className="flex items-center justify-end">
        <RevalidatingIndicator isRevalidating={isRevalidating} />
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Faturamento Paciente */}
        <DataTable
          title="Faturamento Paciente"
          columns={faturamentoColumns}
          data={mockFaturamentoPaciente}
          maxRows={2000}
        />

        {/* Potenciais +4 Meses */}
        <div className="card">
          <h3 className="card-header">Potenciais (+4 Meses sem vir a Clínica)</h3>
          <div className="flex flex-col items-center justify-center py-12">
            <svg viewBox="0 0 24 24" className="w-16 h-16 text-dark-muted" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <p className="text-dark-muted text-sm mt-4">Nenhum resultado!</p>
          </div>
        </div>

        {/* Potenciais -4 Meses */}
        <DataTable
          title="Potenciais (- 4 Meses sem vir a Clínica)"
          columns={potenciaisColumns}
          data={mockPotenciaisMais4Meses}
          maxRows={383}
        />
      </div>

    </div>
  );
}
