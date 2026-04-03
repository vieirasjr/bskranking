import { useNavigate } from 'react-router-dom';
import { Trophy, MapPin, Users, BarChart3, Check, Zap, Shield } from 'lucide-react';
import { motion } from 'motion/react';

const PLANS = [
  {
    id: 'avulso',
    name: 'Evento Avulso',
    price: 50,
    period: 'evento',
    players: 20,
    locations: 1,
    features: [
      '20 jogadores no ranking',
      '1 local de partidas',
      'Link público exclusivo',
      'Fila automática',
      'Placar ao vivo',
      'Acesso por 72 horas',
    ],
    highlight: false,
    badge: 'Evento único',
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 100,
    period: 'mês',
    players: 30,
    locations: 1,
    features: [
      '30 jogadores no ranking',
      '1 local de partidas',
      'Link público exclusivo',
      'Fila automática (10 jogadores)',
      'Placar ao vivo',
      'Ranking com filtros',
    ],
    highlight: false,
    badge: null,
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 150,
    period: 'mês',
    players: 60,
    locations: 2,
    features: [
      '60 jogadores no ranking',
      '2 locais de partidas',
      'Links públicos por local',
      'Fila automática (10 jogadores)',
      'Placar ao vivo',
      'Ranking com filtros por local',
      'Ranking consolidado',
    ],
    highlight: true,
    badge: 'Mais popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 200,
    period: 'mês',
    players: null,
    locations: null,
    features: [
      'Jogadores ilimitados',
      'Locais ilimitados',
      'Links públicos por local',
      'Fila automática (10 jogadores)',
      'Placar ao vivo',
      'Ranking completo por local',
      'Ranking consolidado',
      'Gestão avançada de jogadores',
    ],
    highlight: false,
    badge: 'Completo',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/20 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">Basquete Next</span>
        </div>
        <button
          onClick={() => navigate('/entrar')}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
        >
          Entrar
        </button>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-6">
            <Zap className="w-3 h-3" /> Sistema de fila e ranking em tempo real
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Gerencie seu basquete<br />
            <span className="text-orange-500">como um profissional</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Fila automática, placar ao vivo e ranking com estatísticas.<br />
            Cada local tem sua própria URL pública — compartilhe com seus jogadores.
          </p>
          <button
            onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 rounded-2xl font-bold bg-orange-500 hover:bg-orange-600 text-white text-lg transition-all shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40"
          >
            Ver planos e preços
          </button>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Users className="w-5 h-5 text-orange-500" />, title: 'Fila inteligente', desc: 'Organiza automaticamente 10 jogadores em 2 times de 5. Quem espera mais entra primeiro.' },
            { icon: <BarChart3 className="w-5 h-5 text-orange-500" />, title: 'Ranking real', desc: 'Pontos, assistências, tocos e roubos registrados em tempo real. Pódio animado.' },
            { icon: <MapPin className="w-5 h-5 text-orange-500" />, title: 'URL por local', desc: 'Cada quadra tem seu link exclusivo. Seus jogadores acessam em segundos.' },
          ].map((f) => (
            <div key={f.title} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="pb-28" id="precos">
        <div className="text-center mb-10 px-6">
          <h2 className="text-3xl font-black mb-3">Planos e preços</h2>
          <p className="text-slate-400">Para um evento ou uso contínuo — escolha o que faz sentido para você.</p>
        </div>

        {/* Carrossel */}
        <div className="relative">
          {/* Fade direita — sinaliza continuidade */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-5 w-20 z-10
            bg-gradient-to-l from-slate-950 via-slate-950/70 to-transparent" />

          <div
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-5 px-6 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >

            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col shrink-0 snap-start rounded-2xl border p-6 w-72
                  ${plan.highlight
                    ? 'border-orange-500 bg-orange-500/5 shadow-xl shadow-orange-500/10'
                    : 'border-slate-800 bg-slate-900/60'
                  }`}
              >
                {/* Badge */}
                <div className="h-6 mb-3 flex items-center">
                  {plan.badge ? (
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap
                      ${plan.highlight ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                {/* Nome e preço */}
                <div className="mb-4">
                  <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-orange-400' : 'text-slate-400'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-black text-white">R${plan.price}</span>
                    <span className="text-slate-400 text-sm mb-1">/{plan.period}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1.5">
                    {plan.players ? `${plan.players} jogadores` : 'Jogadores ilimitados'} ·{' '}
                    {plan.locations ? `${plan.locations} ${plan.locations === 1 ? 'local' : 'locais'}` : 'Locais ilimitados'}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-orange-500' : 'text-slate-500'}`} />
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => navigate(`/cadastro?plano=${plan.id}`)}
                  className={`w-full py-3 rounded-xl font-bold transition-all text-sm
                    ${plan.highlight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                >
                  Assinar agora
                </button>
              </div>
            ))}

            {/* Espaço no final para continuidade */}
            <div className="shrink-0 w-2" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4" />
          <span>Pagamentos processados com segurança via Mercado Pago</span>
        </div>
        <p>© {new Date().getFullYear()} Basquete Next · Todos os direitos reservados</p>
      </footer>
    </div>
  );
}
