import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, ShieldCheck, Copy, Check, Mail,
  RefreshCw, QrCode, CreditCard, Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale: string }) => {
      bricks: () => {
        create: (type: string, containerId: string, config: object) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

const PLANS: Record<string, { name: string; price: number; note?: string }> = {
  teste:        { name: 'Experiência 7 dias',  price: 1,    note: '7 dias de acesso · até 5 jogadores/sessão · 1 local' },
  entrada:      { name: 'Plano Entrada',       price: 36.9, note: 'mensal · até 20 jogadores/sessão · 1 local' },
  basico:       { name: 'Plano Básico',        price: 100,  note: 'mensal · até 30 jogadores/sessão · 1 local' },
  profissional: { name: 'Plano Profissional',  price: 150,  note: 'mensal · até 40 jogadores/sessão · 2 locais' },
  enterprise:   { name: 'Plano Enterprise',    price: 200,  note: 'mensal · sessão ilimitada · 4 locais' },
  avulso:       { name: 'Evento Avulso',       price: 50,   note: '72 horas de acesso · máx. 20 atletas' },
};

type Step = 'choose' | 'pix' | 'card';

interface PixData {
  paymentId: string | number;
  qr_code: string;
  qr_code_base64?: string;
  ticket_url?: string;
}

// ── PIX View ────────────────────────────────────────────────────
function PixView({
  planId, tenantId, sessionToken, userEmail, price, onSuccess, onError,
}: {
  planId: string; tenantId: string; sessionToken: string;
  userEmail: string; price: number;
  onSuccess: () => void; onError: (msg: string) => void;
}) {
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [polling, setPolling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createPix = useCallback(async () => {
    setLoading(true);
    setGenerated(false);
    try {
      const res = await fetch('/api/mp/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ planId, tenantId, payerEmail: userEmail }),
      });
      const data = await res.json() as { paymentId?: string; qr_code?: string; qr_code_base64?: string; ticket_url?: string; error?: string };
      if (!res.ok || !data.qr_code) { onError(data.error ?? 'Erro ao gerar PIX.'); return; }
      setPixData({ paymentId: data.paymentId!, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, ticket_url: data.ticket_url });
      setSecondsLeft(900);
      setPolling(true);
      setGenerated(true);
    } catch {
      onError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [planId, tenantId, sessionToken, userEmail, onError]);

  // Polling de status
  useEffect(() => {
    if (!polling || !pixData) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mp/payment-status/${pixData.paymentId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await res.json() as { status?: string };
        if (data.status === 'approved') { setPolling(false); onSuccess(); }
      } catch { /* silencioso */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [polling, pixData, sessionToken, onSuccess]);

  // Countdown
  useEffect(() => {
    if (!polling) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setPolling(false); clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [polling]);

  const copyCode = () => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendEmail = () => {
    if (!pixData?.qr_code) return;
    const subject = encodeURIComponent('Seu código PIX — Braska');
    const body = encodeURIComponent(
      `Olá!\n\nAqui está seu código PIX para pagamento do plano:\n\n${pixData.qr_code}\n\nCopie e cole no seu banco ou app de pagamento.\n\nValor: R$${price.toFixed(2)}\n\nBraska`
    );
    window.open(`mailto:${userEmail}?subject=${subject}&body=${body}`);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  // ── Tela inicial: botão para gerar ──
  if (!generated && !loading) {
    return (
      <div className="flex flex-col items-center gap-6 py-4">
        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center">
          <QrCode className="w-8 h-8 text-orange-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold mb-1">Pagamento via PIX</p>
          <p className="text-slate-400 text-sm">Gere o QR Code e escaneie com o app do seu banco.</p>
          <p className="text-orange-400 font-bold text-lg mt-2">R${price.toFixed(2)}</p>
        </div>
        <button
          onClick={createPix}
          className="w-full max-w-xs py-4 rounded-2xl font-bold bg-orange-500 hover:bg-orange-600 text-white text-base transition-all shadow-lg shadow-orange-500/20 active:scale-95"
        >
          Gerar QR Code PIX
        </button>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      <span className="text-sm">Gerando QR Code PIX...</span>
    </div>
  );

  if (!pixData) return null;

  if (secondsLeft === 0) return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-slate-400 text-sm text-center">QR Code expirado.</p>
      <button onClick={createPix}
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold">
        <RefreshCw className="w-4 h-4" /> Gerar novo QR Code
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        Aguardando pagamento · expira em {mm}:{ss}
      </div>

      {/* QR Code */}
      <div className="p-3 rounded-2xl bg-white shadow-lg shadow-black/20 self-center">
        <QRCodeSVG
          value={pixData.qr_code}
          size={Math.min(220, window.innerWidth - 80)}
          level="M"
          includeMargin={false}
          imageSettings={{ src: '/icon-bsk.png', x: undefined, y: undefined, height: 36, width: 36, excavate: true }}
        />
      </div>

      <p className="text-xs text-slate-500 text-center">
        Escaneie com o app do seu banco · <span className="text-orange-400 font-bold">R${price.toFixed(2)}</span>
      </p>

      {/* Código copia-e-cola */}
      <div className="w-full">
        <p className="text-xs text-slate-500 mb-1.5 font-medium">Código PIX (copia e cola)</p>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
          <span className="text-xs text-slate-400 truncate flex-1 font-mono select-all">
            {pixData.qr_code.slice(0, 50)}…
          </span>
          <button onClick={copyCode}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all active:scale-95">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Enviar por email */}
      <button onClick={sendEmail}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors py-1">
        {emailSent
          ? <><Check className="w-4 h-4 text-green-400" /> Email aberto!</>
          : <><Mail className="w-4 h-4" /> Receber código por email</>}
      </button>

      {/* Sandbox */}
      {(import.meta as unknown as { env: { DEV: boolean } }).env.DEV && pixData?.ticket_url && (
        <div className="w-full rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
          <p className="text-yellow-400 text-xs font-mono font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> SANDBOX — Simular pagamento
          </p>
          <p className="text-yellow-300/60 text-xs">
            Abra o link abaixo, faça login como comprador de teste e aprove o pagamento.
          </p>
          <div className="text-xs text-slate-400 font-mono bg-slate-900 rounded-lg px-2 py-1.5 space-y-0.5">
            <p>email: <span className="text-slate-200">test_user_7731665514199814329@testuser.com</span></p>
            <p>senha: <span className="text-slate-200">aSo4dVTx7X</span></p>
          </div>
          <a href={pixData.ticket_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold transition-all">
            <Zap className="w-3.5 h-3.5" /> Abrir página sandbox
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main Checkout ────────────────────────────────────────────────
export default function DashboardCheckout() {
  const { planId = '' } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { tenant, refresh } = useTenant();
  const containerRef = useRef<HTMLDivElement>(null);
  const brickRef = useRef<{ unmount: () => void } | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const plan = PLANS[planId];

  const handleSuccess = useCallback(() => {
    refresh();
    navigate('/dashboard/assinatura?mp=success');
  }, [refresh, navigate]);

  const handleChoose = (method: 'pix' | 'card') => {
    setError(null);
    setStep(method);
  };

  const handleBack = () => {
    brickRef.current?.unmount();
    brickRef.current = null;
    setError(null);
    setStep('choose');
  };

  // Carrega SDK quando método for cartão
  useEffect(() => {
    if (step !== 'card') return;
    if (document.getElementById('mp-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, [step]);

  // Inicializa Brick de cartão
  useEffect(() => {
    if (step !== 'card' || !sdkReady || !plan || !tenant) return;

    const publicKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_MP_PUBLIC_KEY;
    if (!publicKey) { setError('VITE_MP_PUBLIC_KEY não configurada.'); return; }

    let mounted = true;

    async function initBrick() {
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
      const bricks = mp.bricks();
      brickRef.current = await bricks.create('payment', 'mp-payment-brick', {
        initialization: {
          amount: plan.price,
          payer: { email: session?.user?.email ?? '' },
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            maxInstallments: 1,
          },
          visual: {
            hidePaymentButton: false,
            style: {
              theme: 'dark',
              customVariables: {
                baseColor: '#f97316',
                baseColorFirstVariant: '#ea580c',
                baseColorSecondVariant: '#c2410c',
                errorColor: '#ef4444',
                successColor: '#22c55e',
                outlinePrimaryColor: '#f97316',
                outlineSecondaryColor: '#334155',
                buttonTextColor: '#ffffff',
                borderRadiusSmall: '8px',
                borderRadiusMedium: '12px',
                borderRadiusLarge: '16px',
                inputBackgroundColor: '#0f172a',
                formBackgroundColor: '#0f172a',
                baseColorText: '#f1f5f9',
                labelFontSize: '13px',
              },
            },
          },
        },
        callbacks: {
          onReady: () => {},
          onError: (err: unknown) => {
            if (mounted) setError('Erro ao carregar formulário.');
            console.error('MP Brick error:', err);
          },
          onSubmit: async ({ formData }: { formData: unknown }) => {
            if (!mounted) return;
            setProcessing(true);
            setError(null);
            try {
              const res = await fetch('/api/mp/process-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
                body: JSON.stringify({ formData, planId, tenantId: tenant?.id }),
              });
              const data = await res.json() as { status?: string; status_detail?: string; error?: string; message?: string };
              if (!res.ok) {
                setError(data.error ?? 'Pagamento não aprovado.');
                return;
              }
              if (data.status === 'approved') {
                handleSuccess();
              } else if (data.status === 'pending' || data.status === 'in_process') {
                navigate('/dashboard/assinatura?mp=pending');
              } else {
                setError(data.message ?? 'Pagamento não aprovado. Verifique os dados e tente novamente.');
              }
            } catch {
              setError('Erro de conexão. Tente novamente.');
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
    };
  }, [step, sdkReady, plan, tenant, session, planId, navigate, handleSuccess]);

  if (!plan) return <div className="p-6 text-red-400">Plano inválido.</div>;

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-md w-full mx-auto">

        {/* Voltar */}
        <button
          onClick={step === 'choose' ? () => navigate('/dashboard/assinatura') : handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 'choose' ? 'Voltar' : 'Trocar método de pagamento'}
        </button>

        {/* Cabeçalho do plano */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black text-white mb-1">Finalizar assinatura</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-sm">{plan.name}</span>
            <span className="text-orange-400 font-bold">R${plan.price.toFixed(2)}</span>
            {plan.note && <span className="text-slate-500 text-xs">· {plan.note}</span>}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {/* ── Etapa 1: escolha do método ── */}
        {step === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">Selecione a forma de pagamento:</p>

            {/* PIX */}
            <button
              onClick={() => handleChoose('pix')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group text-left active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                <QrCode className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">PIX</p>
                <p className="text-xs text-slate-400 mt-0.5">Pagamento instantâneo · aprovação em segundos</p>
              </div>
              <div className="shrink-0">
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/15 text-green-400">Instantâneo</span>
              </div>
            </button>

            {/* Cartão */}
            <button
              onClick={() => handleChoose('card')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-700 bg-slate-900 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group text-left active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <CreditCard className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Cartão de crédito</p>
                <p className="text-xs text-slate-400 mt-0.5">Crédito ou débito · pagamento seguro</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Etapa 2a: PIX ── */}
        {step === 'pix' && tenant && (
          <PixView
            planId={planId}
            tenantId={tenant.id}
            sessionToken={session?.access_token ?? ''}
            userEmail={session?.user?.email ?? ''}
            price={plan.price}
            onSuccess={handleSuccess}
            onError={setError}
          />
        )}

        {/* ── Etapa 2b: Cartão ── */}
        {step === 'card' && (
          <>
            {processing && (
              <div className="flex items-center justify-center gap-3 text-orange-400 py-10">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Processando pagamento...</span>
              </div>
            )}
            <div
              id="mp-payment-brick"
              ref={containerRef}
              className={processing ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : ''}
            />
            {!sdkReady && !error && (
              <div className="flex items-center justify-center gap-3 text-slate-400 py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando formulário...</span>
              </div>
            )}
          </>
        )}

        {/* Rodapé segurança + Logo MP */}
        <div className="flex flex-col items-center gap-3 mt-8">
          <img
            src="https://imgmp.mlstatic.com/org-img/banners/br/medios/online/468X60.jpg"
            alt="Meios de pagamento Mercado Pago"
            className="h-8 object-contain opacity-70"
          />
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
            Pagamento processado com segurança via Mercado Pago
          </div>
        </div>
      </div>
    </div>
  );
}
