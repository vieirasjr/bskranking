import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck, Copy, Check, Mail, RefreshCw, QrCode, CreditCard, Zap } from 'lucide-react';
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
  avulso:       { name: 'Evento Avulso',      price: 50,  note: '72 horas de acesso · máx. 20 atletas' },
  basico:       { name: 'Plano Básico',       price: 100 },
  profissional: { name: 'Plano Profissional', price: 150 },
  enterprise:   { name: 'Plano Enterprise',   price: 200 },
};

type PaymentMethod = 'pix' | 'card';

interface PixData {
  paymentId: string | number;
  qr_code: string;
  qr_code_base64?: string;
  ticket_url?: string;
}

// ── PIX View ────────────────────────────────────────────────────
function PixView({
  planId,
  tenantId,
  sessionToken,
  userEmail,
  price,
  onSuccess,
  onError,
}: {
  planId: string;
  tenantId: string;
  sessionToken: string;
  userEmail: string;
  price: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [polling, setPolling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900); // 15 min
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createPix = useCallback(async () => {
    setLoading(true);
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
    } catch {
      onError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [planId, tenantId, sessionToken, userEmail, onError]);

  useEffect(() => { createPix(); }, [createPix]);

  // Polling de status
  useEffect(() => {
    if (!polling || !pixData) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mp/payment-status/${pixData.paymentId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await res.json() as { status?: string };
        if (data.status === 'approved') {
          setPolling(false);
          onSuccess();
        }
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
    const subject = encodeURIComponent('Seu código PIX — Basquete Next');
    const body = encodeURIComponent(
      `Olá!\n\nAqui está seu código PIX para pagamento do plano:\n\n${pixData.qr_code}\n\nCopie e cole no seu banco ou app de pagamento.\n\nValor: R$${price.toFixed(2)}\n\nBasquete Next`
    );
    window.open(`mailto:${userEmail}?subject=${subject}&body=${body}`);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      <span className="text-sm">Gerando QR Code PIX...</span>
    </div>
  );

  if (!pixData) return null;

  if (secondsLeft === 0) return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-slate-400 text-sm text-center">QR Code expirado.</p>
      <button
        onClick={createPix}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold"
      >
        <RefreshCw className="w-4 h-4" /> Gerar novo QR Code
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Status */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        Aguardando pagamento · expira em {mm}:{ss}
      </div>

      {/* QR Code */}
      <div className="p-4 rounded-2xl bg-white shadow-lg shadow-black/20">
        <QRCodeSVG
          value={pixData.qr_code}
          size={200}
          level="M"
          includeMargin={false}
          imageSettings={{
            src: '/icon-bsk.png',
            x: undefined,
            y: undefined,
            height: 36,
            width: 36,
            excavate: true,
          }}
        />
      </div>

      <p className="text-xs text-slate-500 text-center">
        Escaneie com o app do seu banco · R${price.toFixed(2)}
      </p>

      {/* Código copia-e-cola */}
      <div className="w-full">
        <p className="text-xs text-slate-500 mb-1.5 font-medium">Código PIX (copia e cola)</p>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
          <span className="text-xs text-slate-400 truncate flex-1 font-mono select-all">
            {pixData.qr_code.slice(0, 60)}…
          </span>
          <button
            onClick={copyCode}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Enviar por email */}
      <button
        onClick={sendEmail}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {emailSent
          ? <><Check className="w-4 h-4 text-green-400" /> Email aberto!</>
          : <><Mail className="w-4 h-4" /> Receber código por email</>
        }
      </button>

      {/* Painel de simulação — apenas em modo desenvolvimento */}
      {(import.meta as unknown as { env: { DEV: boolean } }).env.DEV && pixData?.ticket_url && (
        <div className="w-full rounded-xl border border-dashed border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
          <p className="text-yellow-400 text-xs font-mono font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> SANDBOX — Simular pagamento
          </p>
          <p className="text-yellow-300/60 text-xs">
            Abra o link abaixo, faça login como comprador de teste e aprove o pagamento. O sistema detecta automaticamente.
          </p>
          <div className="text-xs text-slate-400 font-mono bg-slate-900 rounded-lg px-2 py-1.5 space-y-0.5">
            <p>email: <span className="text-slate-200">test_user_7731665514199814329@testuser.com</span></p>
            <p>senha: <span className="text-slate-200">aSo4dVTx7X</span></p>
          </div>
          <a
            href={pixData.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold transition-all"
          >
            <Zap className="w-3.5 h-3.5" /> Abrir página de pagamento sandbox
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const plan = PLANS[planId];

  const handleSuccess = useCallback(() => {
    refresh();
    navigate('/dashboard/assinatura?mp=success');
  }, [refresh, navigate]);

  // Carrega SDK só quando método for cartão
  useEffect(() => {
    if (paymentMethod !== 'card') return;
    if (document.getElementById('mp-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id = 'mp-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, [paymentMethod]);

  // Inicializa Brick de cartão
  useEffect(() => {
    if (paymentMethod !== 'card' || !sdkReady || !plan || !tenant) return;

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
              const data = await res.json() as { status?: string; error?: string; mp_error?: string };
              if (!res.ok) {
                setError(`${data.error ?? 'Pagamento não aprovado.'} ${data.mp_error ? `(${data.mp_error})` : ''}`);
                return;
              }
              if (data.status === 'approved') {
                handleSuccess();
              } else if (data.status === 'pending' || data.status === 'in_process') {
                navigate('/dashboard/assinatura?mp=pending');
              } else {
                setError('Pagamento não aprovado. Verifique os dados e tente novamente.');
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
  }, [paymentMethod, sdkReady, plan, tenant, session, planId, navigate, handleSuccess]);

  // Desmonta brick ao trocar método
  useEffect(() => {
    if (paymentMethod !== 'card') {
      brickRef.current?.unmount();
      brickRef.current = null;
    }
  }, [paymentMethod]);

  if (!plan) return <div className="p-8 text-red-400">Plano inválido.</div>;

  return (
    <div className="p-8 max-w-md">
      <button
        onClick={() => navigate('/dashboard/assinatura')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-black text-white mb-1">Finalizar assinatura</h1>
      <p className="text-slate-400 text-sm mb-6">
        {plan.name} · <span className="text-orange-400 font-semibold">R${plan.price.toFixed(2)}</span>
        {plan.note && <span className="text-slate-500"> · {plan.note}</span>}
      </p>

      {/* Seletor de método */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setPaymentMethod('pix'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${
            paymentMethod === 'pix'
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          <QrCode className="w-4 h-4" /> PIX
        </button>
        <button
          onClick={() => { setPaymentMethod('card'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${
            paymentMethod === 'card'
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
        >
          <CreditCard className="w-4 h-4" /> Cartão
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* PIX */}
      {paymentMethod === 'pix' && tenant && (
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

      {/* Cartão — MP Brick */}
      {paymentMethod === 'card' && (
        <>
          {processing && (
            <div className="flex items-center justify-center gap-3 text-orange-400 py-8">
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

      <div className="flex items-center gap-2 text-slate-600 text-xs mt-6">
        <ShieldCheck className="w-4 h-4 text-slate-500" />
        Pagamento processado com segurança via Mercado Pago
      </div>
    </div>
  );
}
