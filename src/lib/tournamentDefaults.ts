export type TournamentModality = '1x1' | '3x3' | '5x5';

const RULES_3X3 = `# Regras Oficiais de Basquete 3x3

## Visão Geral
O basquete 3x3 é uma variação dinâmica do basquete tradicional, jogado em meia quadra com duas equipes de três jogadores cada. O jogo é rápido, físico e estratégico, sendo regulamentado pela FIBA.

## Composição das Equipes
- 3 jogadores em quadra
- 1 substituto (opcional)
- Máximo de 4 jogadores por equipe

## Duração da Partida
- Tempo regular: **10 minutos corridos**
- A posse de bola continua durante interrupções (relógio não para)
- Vitória antecipada: primeira equipe a atingir **21 pontos**

## Condições de Vitória
- Vence quem atingir 21 pontos antes do tempo acabar
- Vence quem estiver à frente no placar ao final dos 10 minutos
- Em caso de empate: prorrogação, primeira equipe a marcar **2 pontos** vence

## Pontuação
- Cesta dentro do arco: **1 ponto**
- Cesta fora do arco: **2 pontos**
- Lance livre: **1 ponto**

## Posse de Bola
- Após cesta convertida: a equipe adversária retoma o jogo diretamente de trás do arco (sem reposição formal)
- Após rebote defensivo ou roubo de bola: é obrigatório "limpar" a bola (levar para fora do arco antes de atacar)

## Tempo de Ataque
- Cada equipe tem **12 segundos** para finalizar a jogada

## Substituições
- Permitidas apenas com bola morta
- Devem ocorrer na zona de substituição (próximo à linha de fundo)

## Faltas
- Faltas são contabilizadas por equipe
- A partir da **7ª falta coletiva**: 2 lances livres
- A partir da **10ª falta coletiva**: 2 lances livres + posse de bola

### Tipos de faltas
- Pessoais
- Técnicas
- Antidesportivas

## Regras Especiais
- Não há bola ao alto: posse inicial decidida por moeda ou sorteio
- Alternância de posse em bolas presas
- Jogo reiniciado sempre atrás do arco

## Quadra
- Meia quadra de basquete tradicional, apenas uma cesta
- Linha de 2 pontos equivalente à linha de 3 pontos do basquete tradicional

## Arbitragem
- Geralmente 1 ou 2 árbitros
- Controle de tempo e pontuação pode ser manual ou eletrônico

## Conduta e Fair Play
- Respeito entre jogadores e árbitros é obrigatório
- Atitudes antidesportivas podem resultar em penalidades ou desclassificação
`;

const RULES_5X5 = `# Regras Básicas de Basquete 5x5

## Composição das Equipes
- 5 jogadores em quadra por equipe
- Até 10 jogadores reservas (máximo 15 no elenco)

## Duração da Partida
- 4 períodos de 10 minutos
- Intervalo de 2 minutos entre períodos, 15 minutos no intervalo principal
- Prorrogação de 5 minutos em caso de empate

## Pontuação
- Cesta dentro do arco: **2 pontos**
- Cesta fora do arco: **3 pontos**
- Lance livre: **1 ponto**

## Tempo de Ataque
- 24 segundos por posse

## Faltas
- Jogador eliminado ao cometer 5 faltas pessoais
- Bônus por período a partir da 5ª falta coletiva (lances livres)
`;

const RULES_1X1 = `# Regras de Basquete 1x1

## Formato
- Duelo individual em meia quadra
- Primeiro a atingir **11 pontos** vence (diferença mínima de 2)

## Pontuação
- Cesta dentro do arco: **1 ponto**
- Cesta fora do arco: **2 pontos**

## Posse
- Após cesta convertida, posse passa para o adversário
- Ao recuperar a bola, é obrigatório limpar (levar para trás do arco)

## Tempo de Ataque
- 12 segundos por posse
`;

export const DEFAULT_TOURNAMENT_RULES: Record<TournamentModality, string> = {
  '1x1': RULES_1X1,
  '3x3': RULES_3X3,
  '5x5': RULES_5X5,
};

export interface ModalityDefaults {
  playersPerTeam: number;      // elenco máximo (roster)
  playersOnCourt: number;      // jogadores em quadra
  periodsCount: number;        // quantos períodos
  periodDurationMin: number;   // duração de cada período (minutos)
  matchDurationMin: number;    // duração total da partida (minutos)
}

export const MODALITY_DEFAULTS: Record<TournamentModality, ModalityDefaults> = {
  '1x1': {
    playersPerTeam: 1,
    playersOnCourt: 1,
    periodsCount: 1,
    periodDurationMin: 5,
    matchDurationMin: 5,
  },
  '3x3': {
    playersPerTeam: 4,
    playersOnCourt: 3,
    periodsCount: 1,
    periodDurationMin: 10,
    matchDurationMin: 10,
  },
  '5x5': {
    playersPerTeam: 15,
    playersOnCourt: 5,
    periodsCount: 4,
    periodDurationMin: 10,
    matchDurationMin: 40,
  },
};

export function slugifyTournamentName(name: string, suffix?: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return suffix ? `${base}-${suffix}` : base;
}
