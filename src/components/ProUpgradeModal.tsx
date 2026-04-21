import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Sparkles, ArrowLeft, Clock3 } from 'lucide-react';

interface ProUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onActivated: () => void;
  sessionToken: string;
  userEmail: string;
  darkMode: boolean;
}

const PRO_PRICE = 9.9;

export function ProUpgradeModal({
  open,
  onClose,
  onActivated: _onActivated,
  sessionToken: _sessionToken,
  userEmail: _userEmail,
  darkMode,
}: ProUpgradeModalProps) {
  const benefits = useMemo(() => ([
    '50% OFF em camps e eventos de treinamento',
    '50% OFF em uniformes oficiais disponíveis',
    '2 fotos profissionais por evento',
    '1 card oficial por sessão para compartilhar nas suas redes favoritas.',
    'Perfil customizado com imagem grande',
    'Currículo de atleta integrado ao seu perfil',
    'Maior exposição na rede de treinadores e observadores esportivos da plataforma',
    'Selo PRÓ com mais credibilidade na comunidade',
  ]), []);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border ${
            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="sticky top-0 z-10 px-5 py-4 border-b border-slate-800/70 bg-slate-950/90 backdrop-blur flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white inline-flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-black">
              <Crown className="w-3.5 h-3.5" /> PRÓ R$ 9,90/mês
            </span>
          </div>

          <div className="p-5 sm:p-7">
            <div className="space-y-6">
              <div className="rounded-3xl p-6 border border-orange-500/25 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.22),_transparent_55%)]">
                <p className="text-orange-300 text-xs font-black uppercase tracking-[0.2em] mb-2">Conheça os benefícios do PRÓ</p>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Transforme seu perfil em uma vitrine de atleta profissional
                </h2>
                <p className="text-slate-300 text-sm mt-3">
                  O plano PRÓ está em fase final de preparação. Assim que liberar, o fluxo de assinatura será ativado aqui.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {benefits.map((item) => (
                  <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-200 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                <p className="text-sm text-emerald-300 font-semibold">
                  Investimento mensal: <span className="font-black text-white">R$ {PRO_PRICE.toFixed(2).replace('.', ',')}</span>
                </p>
                <p className="text-xs text-emerald-200/80 mt-1">
                  Assinatura temporariamente indisponível. Em breve liberaremos para todos.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
                <Clock3 className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  Em breve: o pagamento por PIX e cartão será disponibilizado novamente. Por enquanto, nenhum redirecionamento para checkout será realizado.
                </p>
              </div>

              <button
                type="button"
                disabled
                className="w-full py-4 rounded-2xl font-black text-white bg-orange-500/60 cursor-not-allowed"
              >
                Assinatura PRÓ · Em breve
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
