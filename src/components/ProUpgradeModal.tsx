import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Sparkles, ShieldCheck, ArrowLeft, Check, Loader2 } from 'lucide-react';

type Step = 'pitch' | 'checkout' | 'success';

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
  onActivated,
  sessionToken,
  userEmail,
  darkMode,
}: ProUpgradeModalProps) {
  const [step, setStep] = useState<Step>('pitch');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const benefits = useMemo(() => ([
    '50% OFF em camps e eventos de treinamento',
    '50% OFF em uniformes oficiais disponíveis',
    '2 fotos profissionais por evento',
    'Perfil customizado com imagem grande',
    'Currículo de atleta integrado ao seu perfil',
    'Selo PRÓ com mais credibilidade na comunidade',
  ]), []);

  useEffect(() => {
    if (!open) {
      setStep('pitch');
      setError(null);
      setProcessing(false);
    }
  }, [open]);

  const activateSuccess = () => {
    setStep('success');
    onActivated();
  };

  const startRecurringSubscription = async () => {
    setError(null);
    setProcessing(true);
    setStep('checkout');
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('tab', 'perfil');
      currentUrl.searchParams.set('pro', 'success');
      const res = await fetch('/api/mp/pro/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ returnUrl: currentUrl.toString() }),
      });
      const data = await res.json() as { id?: string; init_point?: string; error?: string };
      if (!res.ok || !data.init_point) {
        setError(data.error ?? 'Não foi possível iniciar assinatura recorrente.');
        setStep('pitch');
        return;
      }
      const checkoutUrl = new URL(data.init_point);
      if (data.id) checkoutUrl.searchParams.set('external_reference', data.id);
      window.location.assign(checkoutUrl.toString());
    } catch {
      setError('Erro de conexão ao iniciar assinatura.');
      setStep('pitch');
    } finally {
      setProcessing(false);
    }
  };

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
              onClick={() => {
                if (step === 'pitch') onClose();
                else setStep('pitch');
              }}
              className="text-slate-300 hover:text-white inline-flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-black">
              <Crown className="w-3.5 h-3.5" /> PRÓ R$ 9,90/mês
            </span>
          </div>

          <div className="p-5 sm:p-7">
            {error && (
              <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            {step === 'pitch' && (
              <div className="space-y-6">
                <div className="rounded-3xl p-6 border border-orange-500/25 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.22),_transparent_55%)]">
                  <p className="text-orange-300 text-xs font-black uppercase tracking-[0.2em] mb-2">Conheça os benefícios do PRÓ</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    Transforme seu perfil em uma vitrine de atleta profissional
                  </h2>
                  <p className="text-slate-300 text-sm mt-3">
                    Quem é PRÓ aparece com mais autoridade, atrai oportunidades e economiza em experiências que evoluem performance.
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
                    Investimento mensal: <span className="font-black text-white">R$ 9,90</span>
                  </p>
                  <p className="text-xs text-emerald-200/80 mt-1">
                    Menor que uma taxa de inscrição, com benefícios contínuos para sua imagem e carreira.
                  </p>
                </div>

                <button
                  onClick={startRecurringSubscription}
                  disabled={processing || !sessionToken || !userEmail}
                  className="w-full py-4 rounded-2xl font-black text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                >
                  {processing ? 'Iniciando assinatura...' : 'Quero me tornar PRÓ agora'}
                </button>
              </div>
            )}

            {step === 'checkout' && (
              <div className="py-8 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto" />
                <p className="text-white font-semibold">Redirecionando para assinatura recorrente</p>
                <p className="text-xs text-slate-400">
                  Você vai autorizar a cobrança mensal de R$ 9,90 no ambiente seguro do Mercado Pago.
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-black text-white">Agora você é PRÓ</h3>
                <p className="text-slate-300 text-sm">
                  Seu pagamento foi confirmado e os recursos avançados já estão liberados no seu perfil.
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ativação concluída com segurança
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                >
                  Continuar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
