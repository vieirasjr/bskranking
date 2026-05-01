/**
 * Cursos e masterclasses para treinadores — dados mock até integração com backend/pagamentos.
 */
export type TreinoNivel = 'iniciante' | 'intermediario' | 'avancado';

export interface TreinoCursoInstructor {
  name: string;
  role: string;
  bio: string;
  avatarEmoji?: string;
}

/** Módulos exibidos na página de detalhe (preview do currículo). */
export interface TreinoModuloPreview {
  title: string;
  durationMin: number;
  subtitle: string;
}

export interface TreinoCursoMock {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  /** Resumo técnico do conteúdo (metodologia, foco biomecânico, etc.) */
  technicalSummary: string;
  description: string;
  lessonCount: number;
  /** Horas totais de vídeo (decimal) */
  videoHours: number;
  instructor: TreinoCursoInstructor;
  /** Preço em centavos (BRL), mesmo padrão de torneios */
  priceBrl: number;
  originalPriceBrl?: number;
  level: TreinoNivel;
  category: string;
  tags: string[];
  /** Gradiente Tailwind para capa quando não há imagem */
  coverClass: string;
  ratingAvg: number;
  ratingCount: number;
  studentsCount: number;
  whatYouLearn: string[];
  requirements: string[];
  includesCertificate: boolean;
  updatedAt: string;
  isBestseller?: boolean;
  isNew?: boolean;
  /** Módulos para lista tipo “aulas” na página de detalhe */
  modules: TreinoModuloPreview[];
}

export const TREINO_NIVEL_LABEL: Record<TreinoNivel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const MOCK_TREINOS_CURSOS: TreinoCursoMock[] = [
  {
    id: '1',
    slug: 'arremesso-profissional',
    title: 'Arremesso profissional',
    subtitle: 'Mecânica, ritmo e consistência para o J',
    shortDescription: 'Do pé ao follow-through: correção de defeitos, séries progressivas e leitura de déficit.',
    technicalSummary:
      'Módulos sobre alinhamento de base, ângulo de cotovelo, quadril como motor, timing do punho e análise de vídeo lado a lado. Inclui protocolo de volume semanal e checklist pré-jogo para atletas 12–35 anos.',
    description:
      'Masterclass voltada a treinadores que querem padronizar o ensino do arremesso em grupos heterogêneos. Você recebe progressões por idade, drills com cones e marcações no chão, e modelos de correção verbal mínima para não sobrecarregar o atleta.',
    lessonCount: 18,
    videoHours: 6.5,
    instructor: {
      name: 'Prof. Ricardo Alves',
      role: 'Ex-preparador físico NBB · especialista em arremesso',
      bio: '15 anos trabalhando mecânica de arremesso com categorias de base e adulto. Certificado em análise de movimento aplicada ao basquete.',
      avatarEmoji: '🏀',
    },
    priceBrl: 19700,
    originalPriceBrl: 24900,
    level: 'intermediario',
    category: 'Técnica individual',
    tags: ['arremesso', 'triple threat', 'J'],
    coverClass: 'from-orange-600 via-amber-600 to-slate-900',
    ratingAvg: 4.9,
    ratingCount: 412,
    studentsCount: 2100,
    whatYouLearn: [
      'Corrigir os 5 erros mais comuns sem gerar tensão no ombro',
      'Montar microciclos de 4 semanas para temporada',
      'Usar vídeo com ângulos padronizados em aula em grupo',
    ],
    requirements: [
      'Experiência mínima lecionando basquete (base ou adulto)',
      'Não é necessário equipamento além de bola e celular para filmar',
    ],
    includesCertificate: true,
    updatedAt: '2026-01-15',
    isBestseller: true,
    modules: [
      { title: 'Base e eixo do corpo', durationMin: 22, subtitle: 'Pés, joelhos e quadril no alinhamento' },
      { title: 'Ângulo de cotovelo e entrada', durationMin: 18, subtitle: 'Correção em série com grupo' },
      { title: 'Punho e follow-through', durationMin: 20, subtitle: 'Timing e finalização dos dedos' },
      { title: 'Volume semanal na temporada', durationMin: 25, subtitle: 'Microciclo de 4 semanas' },
      { title: 'Análise de vídeo lado a lado', durationMin: 30, subtitle: 'Ângulos padronizados em quadra' },
      { title: 'Checklist pré-jogo', durationMin: 15, subtitle: 'Transferência para o jogo real' },
    ],
  },
  {
    id: '2',
    slug: 'leitura-de-jogo-e-pick-and-roll',
    title: 'Leitura de jogo & pick-and-roll',
    subtitle: 'Decisões do handler e do pivô em meio jogo',
    shortDescription: 'Quando atacar o ombro, quando sair no pop e como ensinar leituras repetíveis.',
    technicalSummary:
      'Estrutura de ensino em 3 camadas: conceitos (ângulo da tela, spacing), reps guiadas (sem defesa → ajuda → live) e film study com pausas didáticas. Foco em equipes 5x5 juvenil a adulto.',
    description:
      'Curso para treinadores que querem menos improviso e mais linguagem comum no elenco. Trabalhamos nomenclatura, sinais de mão opcionais e como escalar a dificuldade na pré-temporada.',
    lessonCount: 14,
    videoHours: 5.25,
    instructor: {
      name: 'Ana Bezerra',
      role: 'Head coach categorias de formação',
      bio: 'Campeã estadual juvenil. Formação em pedagogia do esporte com foco em jogos reduzidos.',
      avatarEmoji: '📋',
    },
    priceBrl: 16700,
    level: 'avancado',
    category: 'Tática',
    tags: ['PnR', 'meio jogo', 'spacing'],
    coverClass: 'from-violet-600 via-indigo-700 to-slate-900',
    ratingAvg: 4.8,
    ratingCount: 189,
    studentsCount: 890,
    whatYouLearn: [
      'Ensinar o handler a recusar telas ruins sem “ensaiar demais”',
      'Drills 3v3 que transferem direto para 5v5',
      'Roteiro de film study de 20 minutos pós-jogo',
    ],
    requirements: ['Familiaridade com conceitos básicos de ataque posicional'],
    includesCertificate: true,
    updatedAt: '2025-12-01',
    modules: [
      { title: 'Ângulo da tela e spacing', durationMin: 20, subtitle: 'Conceitos de meio jogo' },
      { title: 'Handler: atacar o ombro', durationMin: 24, subtitle: 'Reps guiadas sem defesa' },
      { title: 'Pivô: pop vs roll', durationMin: 26, subtitle: 'Leituras repetíveis' },
      { title: '3v3 → transferência 5v5', durationMin: 22, subtitle: 'Jogos reduzidos' },
      { title: 'Film study em 20 minutos', durationMin: 18, subtitle: 'Pausas didáticas pós-jogo' },
    ],
  },
  {
    id: '3',
    slug: 'forca-e-prevenção-para-quadras',
    title: 'Força & prevenção para quadras',
    subtitle: 'Microciclos em 2 sessões por semana',
    shortDescription: 'Programação enxuta para clubes sem centro de treinamento dedicado.',
    technicalSummary:
      'Progressão de agachamento, salto com pouso controlado, core anti-rotação e deload em semanas de jogo denso. Tabelas de volume por faixa etária e limitações de espaço (meia quadra, corredor).',
    description:
      'Ideal para treinadores que também coordenam preparação física em grupos grandes. Priorizamos exercícios que não competem com o arremesso no mesmo dia e planilhas editáveis.',
    lessonCount: 22,
    videoHours: 8,
    instructor: {
      name: 'Dr. Marcelo Pinto',
      role: 'Fisioterapeuta esportivo · consultoria NBB',
      bio: 'Especialista em joelho e tornozelo no basquete. Autor de material para federações regionais.',
      avatarEmoji: '💪',
    },
    priceBrl: 22900,
    originalPriceBrl: 28900,
    level: 'intermediario',
    category: 'Preparação física',
    tags: ['força', 'lesão', 'periodização'],
    coverClass: 'from-emerald-600 via-teal-700 to-slate-900',
    ratingAvg: 4.95,
    ratingCount: 305,
    studentsCount: 1540,
    whatYouLearn: [
      'Montar 8 semanas de pré-temporada com equipamento mínimo',
      'Sinais de alerta para sobrecarga em adolescentes',
      'Combinar treino de potência com calendário de jogos',
    ],
    requirements: ['Nenhum pré-requisito formal; recomendado para quem já monta treinos semanais'],
    includesCertificate: true,
    updatedAt: '2026-02-01',
    isNew: true,
    modules: [
      { title: 'Agachamento e progressão', durationMin: 28, subtitle: 'Volume por faixa etária' },
      { title: 'Salto e pouso controlado', durationMin: 22, subtitle: 'Integração sem competir com arremesso' },
      { title: 'Core anti-rotação', durationMin: 20, subtitle: 'Tronco no basquete' },
      { title: 'Deload em semana densa', durationMin: 24, subtitle: 'Calendário de jogos' },
      { title: 'Treino em meia quadra', durationMin: 16, subtitle: 'Limitação de espaço' },
    ],
  },
  {
    id: '4',
    slug: 'defesa-individual-e-comunicacao',
    title: 'Defesa individual e comunicação',
    subtitle: 'Voz, ajuda e recuperação em 5v5',
    shortDescription: 'Como ensinar ajuda lateral e fechos sem bagunçar o garrafão.',
    technicalSummary:
      'Progressão defensiva: stance, deslizamento em L, negar meio, comunicação por posição (balão, troca, eu fico). Vídeos com áudio do treinador corrigindo em tempo real.',
    description:
      'Foco em cultura defensiva em equipes amadoras e escolares. Você leva gatilhos verbais curtos e dinâmicas de aquecimento que já trabalham talk defense.',
    lessonCount: 12,
    videoHours: 4,
    instructor: {
      name: 'Paulo “Muralha” Nunes',
      role: 'Assistente técnico foco defensivo',
      bio: '20 anos em categorias de base com índices de defeitos abaixo da média estadual.',
      avatarEmoji: '🛡️',
    },
    priceBrl: 9700,
    level: 'iniciante',
    category: 'Defesa',
    tags: ['defesa', 'comunicação', '5x5'],
    coverClass: 'from-sky-600 via-blue-800 to-slate-900',
    ratingAvg: 4.7,
    ratingCount: 96,
    studentsCount: 620,
    whatYouLearn: [
      'Drills 2v2 e 3v3 que exigem conversa constante',
      'Corrigir overhelp quando o time concede muitos arremessos de canto',
    ],
    requirements: ['Experiência básica comandando treinos de equipe'],
    includesCertificate: true,
    updatedAt: '2025-11-20',
    modules: [
      { title: 'Stance e deslizamento em L', durationMin: 18, subtitle: 'Base defensiva individual' },
      { title: 'Negar o meio e corrida', durationMin: 20, subtitle: 'Contenção sem fouls' },
      { title: 'Ajuda lateral e “eu fico”', durationMin: 24, subtitle: 'Comunicação por posição' },
      { title: 'Drills 2v2 com voz', durationMin: 22, subtitle: 'Talk defense na prática' },
      { title: 'Corrigir overhelp', durationMin: 16, subtitle: 'Cantos e closeouts' },
    ],
  },
  {
    id: '5',
    slug: 'treinos-reduzidos-3v3-e-habilidade',
    title: 'Treinos reduzidos 3x3 & habilidade',
    subtitle: 'Mais toques na bola, mais decisões',
    shortDescription: 'Sequências de 3v3 com regras de contagem para acelerar aprendizado.',
    technicalSummary:
      'Design de sessão: duração 60–75 min, blocos de 3v3 com objetivos explícitos (ex.: só pontos de transição), e integração com 5v5 curto ao final. Inclui PDF de variações.',
    description:
      'Para treinadores de categorias de base que precisam manter engajamento alto com grupo grande. Menos fila, mais leitura.',
    lessonCount: 10,
    videoHours: 3.5,
    instructor: {
      name: 'Letícia Mota',
      role: 'Coordenadora metodologia 3x3 escolar',
      bio: 'Campeã nacional universitária 3x3 · educadora física.',
      avatarEmoji: '⚡',
    },
    priceBrl: 0,
    level: 'iniciante',
    category: 'Metodologia',
    tags: ['3x3', 'jogos reduzidos', 'base'],
    coverClass: 'from-rose-600 via-pink-700 to-slate-900',
    ratingAvg: 4.85,
    ratingCount: 521,
    studentsCount: 4800,
    whatYouLearn: ['Regras de contagem que forçam passes extra', 'Como escalar de 3x3 fechado para transição livre'],
    requirements: [],
    includesCertificate: false,
    updatedAt: '2026-01-28',
    modules: [
      { title: 'Design de sessão 60–75 min', durationMin: 20, subtitle: 'Blocos com objetivo claro' },
      { title: 'Regras de contagem 3v3', durationMin: 18, subtitle: 'Passes e decisões' },
      { title: '3v3 fechado → transição', durationMin: 22, subtitle: 'Escalar dificuldade' },
      { title: 'Fechamento com 5v5 curto', durationMin: 24, subtitle: 'Transferência tática' },
    ],
  },
];

export function getTreinoCursoBySlug(slug: string): TreinoCursoMock | undefined {
  return MOCK_TREINOS_CURSOS.find((c) => c.slug === slug);
}

export function formatTreinoPrice(cents: number): string {
  if (cents <= 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
