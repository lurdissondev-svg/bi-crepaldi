import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  UserCheck,
  Target,
  Users,
  Database,
  RefreshCw,
  HelpCircle,
  Lightbulb,
  BookOpen,
  CheckCircle2,
  Clock,
  Calculator
} from 'lucide-react';

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}

function Section({ icon, title, color, children }: SectionProps) {
  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-primary)] overflow-hidden">
      <div className={`px-6 py-4 border-b border-[var(--color-border-primary)] ${color}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

interface ExplanationCardProps {
  title: string;
  emoji: string;
  children: React.ReactNode;
}

function ExplanationCard({ title, emoji, children }: ExplanationCardProps) {
  return (
    <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{emoji}</span>
        <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function FormulaBox({ formula, description }: { formula: string; description: string }) {
  return (
    <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 border border-[var(--color-border-subtle)] mt-2">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={14} className="text-[var(--color-accent)]" />
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase">Formula</span>
      </div>
      <code className="text-sm font-mono text-[var(--color-accent)] block mb-1">{formula}</code>
      <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}

export function ComoFuncionaPage() {
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <BookOpen size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Como Funcionam os Dados</h1>
            <p className="text-white/80 mt-1">Guia completo para entender cada numero do dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={20} />
              <span className="font-semibold">De onde vem?</span>
            </div>
            <p className="text-sm text-white/80">
              Os dados vem de 2 sistemas: <strong>Belle Software</strong> (vendas e pacientes) e <strong>Bitrix24</strong> (leads e oportunidades)
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={20} />
              <span className="font-semibold">Quando atualiza?</span>
            </div>
            <p className="text-sm text-white/80">
              Os dados sao atualizados <strong>automaticamente a cada 5 minutos</strong>. Voce sempre ve informacoes quase em tempo real!
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} />
              <span className="font-semibold">Qual periodo?</span>
            </div>
            <p className="text-sm text-white/80">
              Por padrao mostramos o <strong>mes atual</strong>, mas voce pode usar os filtros para ver outros periodos
            </p>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <Section
        icon={<LayoutDashboard size={24} className="text-white" />}
        title="Aba Resumo"
        color="bg-gradient-to-r from-blue-500 to-blue-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          A aba Resumo e como um <strong>"painel de controle"</strong> que mostra os numeros mais importantes de uma vez so.
          E a primeira coisa que voce ve ao abrir o sistema!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="Faturamento Total" emoji="💰">
            <p>E a <strong>soma de todo o dinheiro</strong> que entrou na clinica no periodo selecionado.</p>
            <p className="mt-2">Imagine que voce tem um cofrinho e todo dia coloca moedas nele. O faturamento e o total de moedas no cofrinho!</p>
            <FormulaBox
              formula="Faturamento = Soma de todas as vendas pagas"
              description="Somamos o valor de cada servico/produto vendido"
            />
          </ExplanationCard>

          <ExplanationCard title="Variacao %" emoji="📈">
            <p>Mostra se estamos <strong>melhor ou pior</strong> que o mes passado.</p>
            <p className="mt-2">Se o numero for <span className="text-green-500 font-bold">verde com +</span>, estamos vendendo mais! Se for <span className="text-red-500 font-bold">vermelho com -</span>, estamos vendendo menos.</p>
            <FormulaBox
              formula="Variacao = ((Atual - Anterior) / Anterior) x 100"
              description="Comparamos o mes atual com o mes anterior"
            />
          </ExplanationCard>

          <ExplanationCard title="Pacientes Novos" emoji="🆕">
            <p>Sao pessoas que <strong>vieram pela primeira vez</strong> a clinica neste periodo.</p>
            <p className="mt-2">E como contar quantos amigos novos voce fez este mes!</p>
          </ExplanationCard>

          <ExplanationCard title="Pacientes Recorrentes" emoji="🔄">
            <p>Sao pessoas que <strong>ja vieram antes</strong> e voltaram para mais tratamentos.</p>
            <p className="mt-2">Sao como amigos antigos que sempre voltam para brincar com voce!</p>
          </ExplanationCard>

          <ExplanationCard title="Ticket Medio" emoji="🎫">
            <p>E <strong>quanto cada paciente gasta em media</strong> quando vem a clinica.</p>
            <p className="mt-2">Se 10 pacientes gastaram R$1.000 no total, o ticket medio e R$100 (1000 dividido por 10).</p>
            <FormulaBox
              formula="Ticket Medio = Faturamento Total / Numero de Pacientes"
              description="Dividimos o total vendido pela quantidade de pacientes"
            />
          </ExplanationCard>

          <ExplanationCard title="% Pacientes Novos no Faturamento" emoji="🥧">
            <p>Mostra <strong>quanto do nosso dinheiro</strong> veio de pacientes novos.</p>
            <p className="mt-2">Se temos R$100 e R$60 veio de pacientes novos, entao 60% do faturamento e de novos!</p>
          </ExplanationCard>
        </div>
      </Section>

      {/* Faturamento */}
      <Section
        icon={<DollarSign size={24} className="text-white" />}
        title="Aba Faturamento"
        color="bg-gradient-to-r from-green-500 to-emerald-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra <strong>todo o dinheiro</strong> que a clinica esta recebendo, dividido de varias formas para entender melhor de onde vem.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="Faturamento por Estabelecimento" emoji="🏥">
            <p>Mostra <strong>quanto cada unidade/setor faturou</strong>:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li><strong>Dermato:</strong> Procedimentos dermatologicos</li>
              <li><strong>SPA:</strong> Tratamentos esteticos do spa</li>
              <li><strong>Convenio:</strong> Atendimentos por convenio</li>
              <li><strong>Drips:</strong> Tratamentos com soro</li>
              <li><strong>Estetica:</strong> Procedimentos esteticos</li>
              <li><strong>Bela Laser:</strong> Tratamentos a laser</li>
              <li><strong>Nutrologia:</strong> Consultas de nutricao</li>
            </ul>
          </ExplanationCard>

          <ExplanationCard title="Grafico de Evolucao Diaria" emoji="📊">
            <p>Mostra <strong>quanto vendemos cada dia</strong> do mes.</p>
            <p className="mt-2">E como um diario onde anotamos quanto ganhamos cada dia. Assim sabemos quais dias vendemos mais!</p>
          </ExplanationCard>

          <ExplanationCard title="Faturamento Mensal Historico" emoji="📅">
            <p>Compara o <strong>faturamento mes a mes</strong> ao longo do ano.</p>
            <p className="mt-2">Ajuda a ver se estamos crescendo ou se algum mes foi especialmente bom ou ruim.</p>
          </ExplanationCard>

          <ExplanationCard title="Vendas de Hoje" emoji="☀️">
            <p>Mostra <strong>quanto ja vendemos so hoje</strong>.</p>
            <p className="mt-2">Atualiza ao longo do dia para voce acompanhar em tempo real!</p>
          </ExplanationCard>
        </div>
      </Section>

      {/* Marketing */}
      <Section
        icon={<TrendingUp size={24} className="text-white" />}
        title="Aba Marketing"
        color="bg-gradient-to-r from-purple-500 to-pink-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra os <strong>leads</strong> - pessoas interessadas que entraram em contato com a clinica.
          E como contar quantas pessoas levantaram a mao querendo saber mais!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="O que e um Lead?" emoji="🙋">
            <p>Um lead e uma <strong>pessoa interessada</strong> que entrou em contato conosco.</p>
            <p className="mt-2">Pode ser alguem que:</p>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• Mandou mensagem pelo Instagram</li>
              <li>• Preencheu formulario no site</li>
              <li>• Ligou pedindo informacoes</li>
              <li>• Clicou em um anuncio</li>
            </ul>
          </ExplanationCard>

          <ExplanationCard title="Origem do Lead" emoji="🗺️">
            <p>Mostra <strong>de onde cada pessoa veio</strong>:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li><strong>Instagram:</strong> Vieram pelas redes sociais</li>
              <li><strong>Google Ads:</strong> Clicaram em anuncios do Google</li>
              <li><strong>Facebook Ads:</strong> Clicaram em anuncios do Facebook</li>
              <li><strong>Indicacao:</strong> Um amigo indicou</li>
              <li><strong>Organico:</strong> Encontraram sozinhos</li>
            </ul>
          </ExplanationCard>

          <ExplanationCard title="Horario de Chegada" emoji="⏰">
            <p>Mostra <strong>em qual horario</strong> mais pessoas entram em contato.</p>
            <p className="mt-2">Isso ajuda a saber quando devemos ter mais pessoas atendendo!</p>
          </ExplanationCard>

          <ExplanationCard title="Mapa de Calor (Heatmap)" emoji="🔥">
            <p>Um grafico colorido que mostra os <strong>dias e horarios mais movimentados</strong>.</p>
            <p className="mt-2">Cores mais fortes = mais leads. Cores mais fracas = menos leads.</p>
          </ExplanationCard>

          <ExplanationCard title="Status dos Leads" emoji="📋">
            <p>Mostra em que <strong>etapa</strong> cada lead esta:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li><span className="text-blue-500">●</span> <strong>Novo:</strong> Acabou de chegar</li>
              <li><span className="text-yellow-500">●</span> <strong>Em Atendimento:</strong> Estamos conversando</li>
              <li><span className="text-green-500">●</span> <strong>Convertido:</strong> Virou paciente!</li>
              <li><span className="text-red-500">●</span> <strong>Desqualificado:</strong> Nao tinha interesse real</li>
            </ul>
          </ExplanationCard>

          <ExplanationCard title="Taxa de Conversao" emoji="🎯">
            <p>Mostra <strong>quantos leads viraram pacientes</strong>.</p>
            <p className="mt-2">Se tivemos 100 leads e 20 viraram pacientes, a taxa e 20%.</p>
            <FormulaBox
              formula="Taxa = (Leads Convertidos / Total de Leads) x 100"
              description="Quanto maior, melhor estamos convertendo!"
            />
          </ExplanationCard>
        </div>
      </Section>

      {/* Comercial */}
      <Section
        icon={<ShoppingCart size={24} className="text-white" />}
        title="Aba Comercial"
        color="bg-gradient-to-r from-orange-500 to-red-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra as <strong>oportunidades de venda (deals)</strong> - quando um lead esta quase fechando negocio.
          E como acompanhar uma partida de futebol onde queremos fazer gol (fechar a venda)!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="O que e um Deal?" emoji="🤝">
            <p>Um deal e uma <strong>oportunidade de venda</strong> mais avancada que um lead.</p>
            <p className="mt-2">E quando a pessoa ja demonstrou interesse real e estamos negociando o tratamento.</p>
          </ExplanationCard>

          <ExplanationCard title="Funil de Vendas" emoji="🔻">
            <p>Mostra as <strong>etapas</strong> ate fechar uma venda:</p>
            <ol className="mt-2 space-y-1 text-xs list-decimal list-inside">
              <li>Primeiro contato</li>
              <li>Agendamento de avaliacao</li>
              <li>Avaliacao realizada</li>
              <li>Proposta enviada</li>
              <li>Negociacao</li>
              <li>Fechado/Ganho!</li>
            </ol>
          </ExplanationCard>

          <ExplanationCard title="Conversao por Origem" emoji="📊">
            <p>Mostra qual <strong>fonte de leads vende mais</strong>.</p>
            <p className="mt-2">Exemplo: Se Instagram traz 100 leads e 30 compram, a conversao e 30%.</p>
          </ExplanationCard>

          <ExplanationCard title="Valor do Pipeline" emoji="💎">
            <p>E a <strong>soma de todas as oportunidades</strong> em aberto.</p>
            <p className="mt-2">Mostra quanto dinheiro podemos ganhar se fecharmos todos os deals!</p>
          </ExplanationCard>
        </div>
      </Section>

      {/* Atendimento */}
      <Section
        icon={<UserCheck size={24} className="text-white" />}
        title="Aba Atendimento"
        color="bg-gradient-to-r from-teal-500 to-cyan-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra como esta o <strong>atendimento aos pacientes</strong>.
          E como uma nota de satisfacao do servico!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="Tempo de Resposta" emoji="⚡">
            <p>Mostra <strong>quanto tempo demoramos</strong> para responder um lead.</p>
            <p className="mt-2">Quanto mais rapido, melhor! Pessoas nao gostam de esperar.</p>
          </ExplanationCard>

          <ExplanationCard title="Leads por Atendente" emoji="👥">
            <p>Mostra <strong>quantos leads cada pessoa</strong> da equipe atendeu.</p>
            <p className="mt-2">Ajuda a ver quem esta com mais ou menos trabalho.</p>
          </ExplanationCard>

          <ExplanationCard title="Taxa de Agendamento" emoji="📅">
            <p>Mostra <strong>quantos leads agendaram</strong> uma consulta.</p>
            <p className="mt-2">Se de 100 leads, 50 agendaram, a taxa e 50%.</p>
          </ExplanationCard>

          <ExplanationCard title="Motivos de Desqualificacao" emoji="❌">
            <p>Mostra <strong>por que alguns leads nao compraram</strong>:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Preco alto demais</li>
              <li>• Nao respondeu mais</li>
              <li>• Escolheu concorrente</li>
              <li>• Nao era o perfil certo</li>
            </ul>
          </ExplanationCard>
        </div>
      </Section>

      {/* Metas */}
      <Section
        icon={<Target size={24} className="text-white" />}
        title="Aba Quadro de Metas"
        color="bg-gradient-to-r from-amber-500 to-yellow-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra as <strong>metas</strong> (objetivos) de cada setor e quanto ja alcancamos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="O que e Meta?" emoji="🎯">
            <p>Meta e um <strong>objetivo</strong> que queremos alcancar.</p>
            <p className="mt-2">Exemplo: "Queremos faturar R$500.000 este mes"</p>
          </ExplanationCard>

          <ExplanationCard title="% da Meta" emoji="📊">
            <p>Mostra <strong>quanto ja alcancamos</strong> da meta.</p>
            <p className="mt-2">Se a meta e R$500.000 e ja faturamos R$250.000, alcancamos 50%!</p>
            <FormulaBox
              formula="% Meta = (Realizado / Meta) x 100"
              description="Quanto mais proximo de 100%, melhor!"
            />
          </ExplanationCard>

          <ExplanationCard title="Projecao" emoji="🔮">
            <p>Mostra <strong>quanto vamos faturar ate o fim do mes</strong> se continuar no mesmo ritmo.</p>
            <p className="mt-2">E como prever o futuro baseado no que ja aconteceu!</p>
          </ExplanationCard>

          <ExplanationCard title="Cores do Status" emoji="🚦">
            <ul className="space-y-2">
              <li><span className="inline-block w-3 h-3 bg-green-500 rounded mr-2"></span><strong>Verde:</strong> Meta batida ou muito perto!</li>
              <li><span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-2"></span><strong>Amarelo:</strong> Atencao, precisamos acelerar</li>
              <li><span className="inline-block w-3 h-3 bg-red-500 rounded mr-2"></span><strong>Vermelho:</strong> Longe da meta, precisa de acao</li>
            </ul>
          </ExplanationCard>
        </div>
      </Section>

      {/* Pacientes */}
      <Section
        icon={<Users size={24} className="text-white" />}
        title="Aba Pacientes"
        color="bg-gradient-to-r from-rose-500 to-pink-600"
      >
        <p className="text-[var(--color-text-secondary)] mb-4">
          Esta aba mostra informacoes sobre os <strong>pacientes</strong> da clinica.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExplanationCard title="Pacientes Ativos" emoji="✅">
            <p>Pacientes que <strong>vieram recentemente</strong> (ultimos 12 meses).</p>
            <p className="mt-2">Sao os pacientes que ainda mantem relacionamento com a clinica.</p>
          </ExplanationCard>

          <ExplanationCard title="Novos vs Recorrentes" emoji="🔄">
            <p>Divide os pacientes em dois grupos:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li><strong>Novos:</strong> Primeira vez na clinica</li>
              <li><strong>Recorrentes:</strong> Ja vieram antes e voltaram</li>
            </ul>
          </ExplanationCard>

          <ExplanationCard title="Lifetime Value (LTV)" emoji="💎">
            <p>Mostra <strong>quanto cada paciente gasta ao longo do tempo</strong>.</p>
            <p className="mt-2">Um paciente que vem todo mes e mais valioso que um que veio uma vez so!</p>
          </ExplanationCard>

          <ExplanationCard title="Frequencia" emoji="📅">
            <p>Mostra <strong>de quanto em quanto tempo</strong> os pacientes voltam.</p>
            <p className="mt-2">Exemplo: Em media, pacientes voltam a cada 45 dias.</p>
          </ExplanationCard>
        </div>
      </Section>

      {/* Glossario */}
      <div className="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-primary)] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Lightbulb size={24} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Glossario - Palavras Importantes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { term: 'Lead', def: 'Pessoa interessada que entrou em contato' },
            { term: 'Deal', def: 'Oportunidade de venda em negociacao' },
            { term: 'Conversao', def: 'Quando um lead vira paciente' },
            { term: 'Ticket Medio', def: 'Valor medio gasto por paciente' },
            { term: 'Faturamento', def: 'Total de dinheiro recebido' },
            { term: 'Meta', def: 'Objetivo a ser alcancado' },
            { term: 'Funil', def: 'Etapas do processo de venda' },
            { term: 'ROI', def: 'Retorno sobre o investimento' },
            { term: 'Pipeline', def: 'Conjunto de oportunidades em aberto' },
            { term: 'Recorrente', def: 'Paciente que volta varias vezes' },
            { term: 'Organico', def: 'Que veio sem anuncio pago' },
            { term: 'UTM', def: 'Codigo que rastreia origem do lead' },
          ].map((item) => (
            <div key={item.term} className="flex items-start gap-2 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">{item.term}:</span>
                <span className="text-[var(--color-text-secondary)] text-sm ml-1">{item.def}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Duvidas */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle size={24} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Ainda tem duvidas?</h2>
        </div>
        <p className="text-[var(--color-text-secondary)]">
          Se algum numero nao faz sentido ou voce quer entender melhor algum dado especifico,
          entre em contato com a equipe de TI ou o responsavel pelo BI. Estamos aqui para ajudar!
        </p>
      </div>
    </div>
  );
}
