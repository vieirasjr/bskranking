import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Sparkles, ShieldCheck, ArrowLeft, Check, Loader2, QrCode, CreditCard, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale: string }) => {
      bricks: () => {
        create: (type: string, containerId: string, config: object) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

type Step = 'pitch' | 'choose' | 'pix' | 'card' | 'success';

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
  const [sdkReady, setSdkReady] = useState(false);
  const [pixCode, setPixCode] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState<string | number | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const brickRef = useRef<{ unmount: () => void } | null>(null);

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

  useEffect(() => {
    if (!open) {
      setStep('pitch');
      setError(null);
      setPixCode('');
      setPixPaymentId(null);
      setCopied(false);
      setProcessing(false);
      brickRef.current?.unmount();
      brickRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'card' || !open) return;
    if (document.getElementById('mp-sdk')) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, [step, open]);

  const activateSuccess = useCallback(() => {
    setStep('success');
    onActivated();
  }, [onActivated]);

  useEffect(() => {
    if (step !== 'card' || !sdkReady || !open) return;
    const publicKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError('VITE_MP_PUBLIC_KEY não configurada.');
      return;
    }
    let mounted = true;

    async function initBrick() {
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
      const bricks = mp.bricks();
      brickRef.current = await bricks.create('payment', 'mp-pro-brick', {
        initialization: {
          amount: PRO_PRICE,
          payer: { email: userEmail },
        },
        customization: {
          paymentMethods: {
            maxInstallments: 1,
          },
          visual: {
            style: {
              theme: 'dark',
              customVariables: {
                baseColor: '#f97316',
                outlinePrimaryColor: '#f97316',
                borderRadiusMedium: '12px',
                inputBackgroundColor: '#0f172a',
                formBackgroundColor: '#0f172a',
                baseColorText: '#f1f5f9',
              },
            },
          },
        },
        callbacks: {
          onError: () => {
            if (mounted) setError('Erro ao carregar pagamento por cartão.');
          },
          onSubmit: async ({ formData }: { formData: unknown }) => {
            if (!mounted) return;
            setProcessing(true);
            setError(null);
            try {
              const res = await fetch('/api/mp/pro/process-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ formData }),
              });
              const data = await res.json() as { status?: string; message?: string; error?: string };
              if (!res.ok) {
                setError(data.error ?? 'Pagamento não aprovado.');
                return;
              }
              if (data.status === 'approved') {
                activateSuccess();
              } else {
                setError(data.message ?? 'Pagamento pendente. Tente novamente em instantes.');
              }
            } catch {
              setError('Erro de conexão ao processar pagamento.');
            } finally {
              if (mounted) setProcessing(false);
            }
          },
        },
      });
    }

    initBrick();
    return () => {
      mounted = false;
      brickRef.current?.unmount();
      brickRef.current = null;
    };
  }, [step, sdkReady, open, sessionToken, userEmail, activateSuccess]);

  useEffect(() => {
    if (step !== 'pix' || !pixPaymentId || !open) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mp/pro/payment-status/${pixPaymentId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await res.json() as { status?: string };
        if (data.status === 'approved') {
          if (pollRef.current) clearInterval(pollRef.current);
          activateSuccess();
        }
      } catch {
        // polling silencioso
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, pixPaymentId, sessionToken, open, activateSuccess]);

  const createPix = async () => {
    setError(null);
    setProcessing(true);
    try {
      const res = await fetch('/api/mp/pro/create-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ payerEmail: userEmail }),
      });
      const data = await res.json() as { paymentId?: string | number; qr_code?: string; error?: string };
      if (!res.ok || !data.qr_code || !data.paymentId) {
        setError(data.error ?? 'Não foi possível gerar PIX.');
        return;
      }
      setPixCode(data.qr_code);
      setPixPaymentId(data.paymentId);
    } catch {
      setError('Erro de conexão ao gerar PIX.');
    } finally {
      setProcessing(false);
    }
  };

  const copyPix = async () => {
    if (!pixCode) return;
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
                else if (step === 'choose') setStep('pitch');
                else setStep('choose');
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
                    Quem é PRÓ aparece com mais autoridade, amplia visibilidade esportiva e economiza em experiências que evoluem performance.
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

                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    O Perfil PRÓ inclui recursos de compartilhamento do perfil com a rede de treinadores do aplicativo e mecanismos de busca com cruzamento de dados para apoiar a identificação de atletas em potencial por olheiros e representantes.
                    Isso pode aumentar suas chances de ser notado, mas não representa garantia de contato, convite, avaliação, contratação ou qualquer resultado esportivo/comercial específico.
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 px-4 py-3">
                  <p className="text-xs text-orange-200/90 leading-relaxed">
                    Atletas PRÓ podem solicitar até 1 card de performance por sessão, com consentimento do jogador e sujeito à análise interna antes de publicação oficial.
                  </p>
                </div>

                <button
                  onClick={() => setStep('choose')}
                  disabled={processing || !sessionToken || !userEmail}
                  className="w-full py-4 rounded-2xl font-black text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                >
                  Quero me tornar PRÓ agora
                </button>
              </div>
            )}

            {step === 'choose' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300 mb-1">Escolha a forma de pagamento</p>
                <button
                  onClick={() => {
                    setStep('pix');
                    if (!pixCode) createPix();
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-orange-500/50 text-left"
                >
                  <QrCode className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="font-bold text-white text-sm">PIX</p>
                    <p className="text-xs text-slate-400">Ativação rápida após confirmação</p>
                  </div>
                </button>
                <button
                  onClick={() => setStep('card')}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-orange-500/50 text-left"
                >
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="font-bold text-white text-sm">Cartão</p>
                    <p className="text-xs text-slate-400">Pagamento direto e seguro</p>
                  </div>
                </button>
              </div>
            )}

            {step === 'pix' && (
              <div className="space-y-4">
                {processing && !pixCode ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" /> Gerando PIX...
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">
                      Escaneie o QR code para ativar seu Perfil PRÓ.
                    </p>
                    {pixCode && (
                      <>
                        <div className="bg-white p-3 rounded-2xl inline-flex">
                          <QRCodeSVG value={pixCode} size={220} />
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 flex items-center gap-2">
                          <span className="text-xs text-slate-400 truncate flex-1 font-mono">
                            {pixCode}
                          </span>
                          <button
                            onClick={copyPix}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center gap-1"
                          >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 'card' && (
              <div>
                {processing && (
                  <div className="py-6 flex items-center justify-center gap-2 text-orange-300">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processando...
                  </div>
                )}
                <div id="mp-pro-brick" className={processing ? 'opacity-60 pointer-events-none' : ''} />
                {!sdkReady && !error && (
                  <div className="py-8 text-sm text-slate-400 flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando formulário...
                  </div>
                )}
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
