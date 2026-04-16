import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { MercadoPagoConfig, Payment, Preference, PaymentRefund } from "mercadopago";

// Carrega .env antes de qualquer outra coisa
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Supabase service role (lazy — só instancia quando necessário) ─
let _supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) {
      throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para os endpoints /api/mp/*");
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

// ── Mercado Pago SDK ─────────────────────────────────────────
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? "";

const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
const mpPayment = new Payment(mpClient);
const mpPreference = new Preference(mpClient);
const mpRefund = new PaymentRefund(mpClient);

const PLAN_NAMES: Record<string, string> = {
  teste:        "Braska - Experiência 7 dias",
  entrada:      "Braska - Plano Entrada",
  basico:       "Braska - Plano Básico",
  profissional: "Braska - Plano Profissional",
  enterprise:   "Braska - Plano Enterprise",
  avulso:       "Braska - Evento Avulso",
};
const PLAN_DESCRIPTIONS: Record<string, string> = {
  teste:        "Braska Experiência 7 dias - até 5 jogadores/sessão, 1 local",
  entrada:      "Assinatura mensal Braska Plano Entrada - até 20 jogadores/sessão, 1 local",
  basico:       "Assinatura mensal Braska Plano Básico - até 30 jogadores/sessão, 1 local",
  profissional: "Assinatura mensal Braska Plano Profissional - até 40 jogadores/sessão, 2 locais",
  enterprise:   "Assinatura mensal Braska Plano Enterprise - sessão ilimitada, 4 locais",
  avulso:       "Acesso avulso Braska - 72 horas de acesso, máx. 20 atletas",
};
const PLAN_PRICES: Record<string, number> = {
  teste: 1,
  entrada: 36,
  basico: 100,
  profissional: 150,
  enterprise: 200,
  avulso: 50,
};
// Garante que o valor enviado ao MP tenha no máximo 2 casas decimais
// (evita artefatos de floating-point como 36.90000000000000035527…)
function mpAmount(price: number): number {
  return Math.round(price * 100) / 100;
}
// Planos com expiração por tempo (horas) em vez de ciclo mensal
const PLAN_EXPIRY_HOURS: Record<string, number> = {
  teste: 168, // 7 dias
  avulso: 72,
};

// Mensagens amigáveis para status_detail do MP
const MP_STATUS_MESSAGES: Record<string, string> = {
  accredited: "Pagamento aprovado com sucesso!",
  pending_contingency: "Pagamento em processamento. Será aprovado em até 2 dias úteis.",
  pending_review_manual: "Pagamento em análise. Será avaliado em até 2 dias úteis.",
  cc_rejected_bad_filled_card_number: "Número do cartão incorreto. Confira e tente novamente.",
  cc_rejected_bad_filled_date: "Data de validade incorreta. Confira e tente novamente.",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos. Confira e tente novamente.",
  cc_rejected_bad_filled_security_code: "Código de segurança incorreto. Confira e tente novamente.",
  cc_rejected_blacklist: "Pagamento não aprovado. Use outro método de pagamento.",
  cc_rejected_call_for_authorize: "Pagamento não autorizado. Entre em contato com a operadora do cartão.",
  cc_rejected_card_disabled: "Cartão desabilitado. Entre em contato com a operadora para ativá-lo.",
  cc_rejected_duplicated_payment: "Pagamento duplicado. Um pagamento idêntico já foi processado.",
  cc_rejected_high_risk: "Pagamento recusado por segurança. Use outro método de pagamento.",
  cc_rejected_insufficient_amount: "Saldo insuficiente. Use outro cartão ou método de pagamento.",
  cc_rejected_invalid_installments: "Parcelamento não disponível. Tente à vista.",
  cc_rejected_max_attempts: "Limite de tentativas atingido. Tente novamente em algumas horas.",
  cc_rejected_other_reason: "Pagamento não aprovado. Tente outro cartão ou método.",
  rejected_by_bank: "Pagamento recusado pelo banco. Entre em contato com a operadora.",
  rejected_by_regulations: "Pagamento não aprovado por regulamentação. Use outro método.",
};

function getPaymentMessage(statusDetail?: string): string {
  if (!statusDetail) return "Erro ao processar pagamento.";
  return MP_STATUS_MESSAGES[statusDetail] ?? "Pagamento não aprovado. Tente outro método de pagamento.";
}

// Busca dados do usuário no Supabase para enviar ao MP
async function getPayerInfo(userId: string) {
  const { data: userRow } = await getSupabaseAdmin().auth.admin.getUserById(userId);
  const email = userRow?.user?.email ?? "";
  const meta = userRow?.user?.user_metadata as Record<string, string> | undefined;

  // Tenta buscar dados extras da tabela basquete_users
  const { data: buRow } = await getSupabaseAdmin()
    .from("basquete_users")
    .select("nome, telefone")
    .eq("auth_id", userId)
    .maybeSingle();

  const fullName = buRow?.nome ?? meta?.full_name ?? meta?.name ?? "";
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

  return {
    email,
    first_name: firstName,
    last_name: lastName,
    phone: buRow?.telefone ?? "",
  };
}

// ── Validate Supabase JWT ────────────────────────────────────
async function validateJWT(req: express.Request): Promise<{ userId: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) next();
    else {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    }
  });

  // ── Health ───────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  // ── POST /api/mp/create-preference ──────────────────────
  // Cria uma preferência Checkout Pro no Mercado Pago
  app.post("/api/mp/create-preference", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { planId, tenantId } = req.body as { planId?: string; tenantId?: string };
    if (!planId || !PLAN_PRICES[planId]) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    const { data: tenant } = await getSupabaseAdmin()
      .from("tenants")
      .select("id, owner_auth_id")
      .eq("id", tenantId ?? "")
      .eq("owner_auth_id", auth.userId)
      .maybeSingle();

    if (!tenant) return res.status(403).json({ error: "Tenant não encontrado." });

    const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const isPublicUrl = !baseUrl.includes("localhost") && !baseUrl.includes("127.0.0.1");
    const payer = await getPayerInfo(auth.userId);

    const amount = mpAmount(PLAN_PRICES[planId]);

    try {
      const mpData = await mpPreference.create({
        body: {
          items: [{
            id: planId,
            title: PLAN_NAMES[planId],
            description: PLAN_DESCRIPTIONS[planId],
            category_id: "services",
            quantity: 1,
            currency_id: "BRL",
            unit_price: amount,
          }],
          payer: {
            email: (req.body.email as string | undefined) ?? payer.email,
            name: payer.first_name || undefined,
            surname: payer.last_name || undefined,
            ...(payer.phone ? { phone: { area_code: "55", number: payer.phone.replace(/\D/g, "").slice(-9) } } : {}),
          },
          back_urls: {
            success: `${baseUrl}/dashboard/assinatura?mp=success&plan=${planId}`,
            failure: `${baseUrl}/dashboard/assinatura?mp=failure`,
            pending: `${baseUrl}/dashboard/assinatura?mp=pending`,
          },
          ...(isPublicUrl && { auto_return: "approved" as const }),
          binary_mode: true,
          external_reference: `${tenant.id}|${planId}`,
          notification_url: isPublicUrl ? `${baseUrl}/api/webhook/mercadopago?source_news=webhooks` : undefined,
          statement_descriptor: "BRASKA",
          payment_methods: {
            installments: 1,
          },
        },
      });

      // Salvar mp_preference_id e plan_id no tenant
      await getSupabaseAdmin()
        .from("tenants")
        .update({
          mp_preference_id: mpData.id as string,
          plan_id: planId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      return res.json({
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        id: mpData.id,
      });
    } catch (err: unknown) {
      console.error("MP create-preference error:", err);
      return res.status(502).json({ error: "Erro ao criar preferência de pagamento." });
    }
  });

  // ── POST /api/mp/process-payment ───────────────────────
  // Processa pagamento via Payment Brick (card token, pix, etc.)
  app.post("/api/mp/process-payment", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { formData, planId, tenantId } = req.body as {
      formData?: Record<string, unknown>;
      planId?: string;
      tenantId?: string;
    };

    if (!formData || !planId || !PLAN_PRICES[planId]) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    const { data: tenant } = await getSupabaseAdmin()
      .from("tenants")
      .select("id, owner_auth_id")
      .eq("id", tenantId ?? "")
      .eq("owner_auth_id", auth.userId)
      .maybeSingle();

    if (!tenant) return res.status(403).json({ error: "Tenant não encontrado." });

    const payer = await getPayerInfo(auth.userId);
    const amount = mpAmount(PLAN_PRICES[planId]);

    try {
      const payment = await mpPayment.create({
        body: {
          ...formData,
          transaction_amount: amount,
          description: PLAN_DESCRIPTIONS[planId],
          external_reference: `${tenant.id}|${planId}`,
          statement_descriptor: "BRASKA",
          binary_mode: true,
          installments: 1,
          payer: {
            ...(formData.payer as Record<string, unknown> ?? {}),
            email: ((formData.payer as Record<string, unknown>)?.email as string) || payer.email,
            first_name: payer.first_name || undefined,
            last_name: payer.last_name || undefined,
          },
          additional_info: {
            items: [{
              id: planId,
              title: PLAN_NAMES[planId],
              description: PLAN_DESCRIPTIONS[planId],
              category_id: "services",
              quantity: 1,
              unit_price: amount,
            }],
            payer: {
              first_name: payer.first_name || undefined,
              last_name: payer.last_name || undefined,
            },
          },
        },
        requestOptions: {
          idempotencyKey: `${tenant.id}-${planId}-${Date.now()}`,
        },
      });

      const expiryHours = PLAN_EXPIRY_HOURS[planId];
      const periodEnd = new Date();
      if (expiryHours) {
        periodEnd.setHours(periodEnd.getHours() + expiryHours);
      } else {
        periodEnd.setDate(periodEnd.getDate() + 30);
      }

      if (payment.status === "approved") {
        await getSupabaseAdmin().from("tenants").update({
          status: "active",
          plan_id: planId,
          mp_payer_id: String(payment.payer?.id ?? ""),
          current_period_ends_at: periodEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", tenant.id);
      }

      await getSupabaseAdmin().from("subscription_events").insert({
        tenant_id: tenant.id,
        mp_payment_id: String(payment.id ?? ""),
        mp_status: payment.status as string,
        mp_type: "payment_brick",
        raw_payload: payment,
      });

      const statusDetail = (payment as any).status_detail as string | undefined;
      return res.json({
        status: payment.status,
        status_detail: statusDetail,
        id: payment.id,
        message: getPaymentMessage(statusDetail),
      });
    } catch (err: unknown) {
      console.error("MP process-payment error:", JSON.stringify(err, null, 2));
      const mpErr = err as { message?: string; cause?: Array<{ code?: string; description: string }> };
      const detail = mpErr.cause?.[0]?.description ?? mpErr.message ?? "Erro ao processar pagamento.";
      console.error("MP process-payment detail:", detail);
      return res.status(502).json({ error: detail });
    }
  });

  // ── POST /api/mp/create-pix ────────────────────────────
  app.post("/api/mp/create-pix", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { planId, tenantId, payerEmail } = req.body as {
      planId?: string;
      tenantId?: string;
      payerEmail?: string;
    };

    if (!planId || !PLAN_PRICES[planId]) {
      return res.status(400).json({ error: "Plano inválido." });
    }

    const { data: tenant } = await getSupabaseAdmin()
      .from("tenants")
      .select("id, owner_auth_id")
      .eq("id", tenantId ?? "")
      .eq("owner_auth_id", auth.userId)
      .maybeSingle();

    if (!tenant) return res.status(403).json({ error: "Tenant não encontrado." });

    const payer = await getPayerInfo(auth.userId);
    const rawEmail = payerEmail ?? payer.email;
    // Emails @testuser.com são contas de vendedor no MP — usar fallback como payer
    const email = rawEmail.endsWith("@testuser.com")
      ? "comprador@braska.app"
      : (rawEmail || "comprador@braska.app");

    const amount = mpAmount(PLAN_PRICES[planId]);

    try {
      const payment = await mpPayment.create({
        body: {
          transaction_amount: amount,
          payment_method_id: "pix",
          description: PLAN_DESCRIPTIONS[planId],
          external_reference: `${tenant.id}|${planId}`,
          statement_descriptor: "BRASKA",
          payer: {
            email,
            first_name: payer.first_name || undefined,
            last_name: payer.last_name || undefined,
          },
          additional_info: {
            items: [{
              id: planId,
              title: PLAN_NAMES[planId],
              description: PLAN_DESCRIPTIONS[planId],
              category_id: "services",
              quantity: 1,
              unit_price: amount,
            }],
            payer: {
              first_name: payer.first_name || undefined,
              last_name: payer.last_name || undefined,
            },
          },
        },
        requestOptions: {
          idempotencyKey: `pix-${tenant.id}-${planId}-${Date.now()}`,
        },
      });

      const txData = (payment as any).point_of_interaction?.transaction_data;

      return res.json({
        paymentId: payment.id,
        status: payment.status,
        qr_code: txData?.qr_code,
        qr_code_base64: txData?.qr_code_base64,
        ticket_url: txData?.ticket_url,
      });
    } catch (err: unknown) {
      console.error("MP create-pix error:", JSON.stringify(err, null, 2));
      const mpErr = err as { message?: string; cause?: Array<{ code?: string; description: string }> };
      const detail = mpErr.cause?.[0]?.description ?? mpErr.message ?? "Erro ao gerar PIX.";
      console.error("MP create-pix detail:", detail);
      return res.status(502).json({ error: detail });
    }
  });

  // ── GET /api/mp/payment-status/:paymentId ───────────────
  app.get("/api/mp/payment-status/:paymentId", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { paymentId } = req.params;

    try {
      const payment = await mpPayment.get({ id: paymentId });

      if (payment.status === "approved") {
        const externalRef = (payment.external_reference as string) ?? "";
        const [tenantId, planId] = externalRef.split("|");

        if (tenantId && planId) {
          const { data: tenant } = await getSupabaseAdmin()
            .from("tenants")
            .select("id, owner_auth_id, status")
            .eq("id", tenantId)
            .eq("owner_auth_id", auth.userId)
            .maybeSingle();

          if (tenant && tenant.status !== "active") {
            const expiryHours = PLAN_EXPIRY_HOURS[planId];
            const periodEnd = new Date();
            if (expiryHours) {
              periodEnd.setHours(periodEnd.getHours() + expiryHours);
            } else {
              periodEnd.setDate(periodEnd.getDate() + 30);
            }
            await getSupabaseAdmin().from("tenants").update({
              status: "active",
              plan_id: planId,
              current_period_ends_at: periodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", tenantId);

            await getSupabaseAdmin().from("subscription_events").insert({
              tenant_id: tenantId,
              mp_payment_id: String(payment.id),
              mp_status: "approved",
              mp_type: "pix",
              raw_payload: payment,
            });
          }
        }
      }

      return res.json({ status: payment.status, id: payment.id });
    } catch (err) {
      console.error("MP payment-status error:", err);
      return res.status(502).json({ error: "Erro ao consultar pagamento." });
    }
  });

  // ── POST /api/mp/simulate-pix/:paymentId (sandbox only) ─
  app.post("/api/mp/simulate-pix/:paymentId", async (req, res) => {
    if (!MP_ACCESS_TOKEN.startsWith("TEST-")) {
      return res.status(403).json({ error: "Simulação disponível apenas em sandbox." });
    }
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { paymentId } = req.params;
    // simulate-pix usa fetch direto — SDK não tem método de simulação
    const simRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      body: JSON.stringify({ status: "approved", status_detail: "accredited" }),
    });
    const data = await simRes.json() as Record<string, unknown>;
    if (!simRes.ok) {
      console.error("MP simulate-pix error:", data);
      return res.status(502).json({ error: (data.message as string) ?? "Erro ao simular pagamento." });
    }
    return res.json({ status: data.status });
  });

  // ── DELETE /api/mp/cancel-subscription/:subscriptionId ──
  app.delete("/api/mp/cancel-subscription/:subscriptionId", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { subscriptionId } = req.params;

    // Verificar que o tenant pertence ao usuário
    const { data: tenant } = await getSupabaseAdmin()
      .from("tenants")
      .select("id")
      .eq("owner_auth_id", auth.userId)
      .eq("mp_subscription_id", subscriptionId)
      .maybeSingle();

    if (!tenant) return res.status(403).json({ error: "Não autorizado." });

    try {
      const mpPreApproval = new (await import("mercadopago")).PreApproval(mpClient);
      await mpPreApproval.update({ id: subscriptionId, body: { status: "cancelled" } });
    } catch (err) {
      console.error("MP cancel-subscription error:", err);
      return res.status(502).json({ error: "Erro ao cancelar no Mercado Pago." });
    }

    await getSupabaseAdmin()
      .from("tenants")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", tenant.id);

    return res.json({ ok: true });
  });

  // ── OPTIONS /api/webhook/mercadopago ──────────────────────
  // MP pode enviar preflight CORS antes do POST
  app.options("/api/webhook/mercadopago", (_req, res) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    });
    res.status(200).end();
  });

  // ── GET /api/webhook/mercadopago ─────────────────────────
  // MP valida o endpoint com GET antes de enviar notificações
  app.get("/api/webhook/mercadopago", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // ── POST /api/mp/cancel-payment/:paymentId ──────────────
  // Cancela pagamento pendente/in_process
  app.post("/api/mp/cancel-payment/:paymentId", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { paymentId } = req.params;

    try {
      const payment = await mpPayment.cancel({ id: paymentId });
      return res.json({ status: payment.status, id: payment.id });
    } catch (err: unknown) {
      console.error("MP cancel-payment error:", err);
      return res.status(502).json({ error: "Erro ao cancelar pagamento." });
    }
  });

  // ── POST /api/mp/refund/:paymentId ─────────────────────
  // Reembolso total ou parcial
  app.post("/api/mp/refund/:paymentId", async (req, res) => {
    const auth = await validateAdmin(req);
    if (!auth) return res.status(403).json({ error: "Acesso negado." });

    const { paymentId } = req.params;
    const { amount } = req.body as { amount?: number };

    try {
      const refund = await mpRefund.create({
        payment_id: paymentId,
        body: amount ? { amount } : {},
      });
      return res.json({ id: refund.id, status: refund.status, amount: refund.amount });
    } catch (err: unknown) {
      console.error("MP refund error:", err);
      return res.status(502).json({ error: "Erro ao processar reembolso." });
    }
  });

  // ── POST /api/webhook/mercadopago ────────────────────────
  // Recebe notificações do MP (pagamentos, assinaturas)
  app.post("/api/webhook/mercadopago", async (req, res) => {
    // Responde 200 imediatamente para o MP não retentar
    res.set("Access-Control-Allow-Origin", "*");
    res.status(200).json({ ok: true });

    try {
      // MP envia type/data.id tanto no body quanto na query string — usa os dois
      const type: string = req.body?.type ?? req.query.type;
      const paymentId: string = req.body?.data?.id ?? req.query["data.id"];

      console.log(`Webhook recebido: type=${type} paymentId=${paymentId}`);

      if (type === "payment" && paymentId) {
        // Consulta pagamento via SDK oficial
        const payment = await mpPayment.get({ id: paymentId });

        const externalRef = (payment.external_reference as string) ?? "";
        const [tenantId, planId] = externalRef.split("|");
        if (!tenantId) { console.log("Webhook: external_reference vazio, ignorando."); return; }

        console.log(`Webhook payment ${paymentId}: status=${payment.status} tenant=${tenantId} plan=${planId}`);

        if (payment.status === "approved") {
          const expiryHours = planId ? PLAN_EXPIRY_HOURS[planId] : undefined;
          const periodEnd = new Date();
          if (expiryHours) {
            periodEnd.setHours(periodEnd.getHours() + expiryHours);
          } else {
            periodEnd.setDate(periodEnd.getDate() + 30);
          }
          await getSupabaseAdmin().from("tenants").update({
            status: "active",
            plan_id: planId ?? undefined,
            mp_payer_id: String(payment.payer?.id ?? ""),
            current_period_ends_at: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", tenantId);
          console.log(`Webhook: tenant ${tenantId} ativado com plano ${planId}`);
        } else if (payment.status === "rejected" || payment.status === "cancelled") {
          await getSupabaseAdmin().from("tenants").update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("id", tenantId);
        }

        await getSupabaseAdmin().from("subscription_events").insert({
          tenant_id: tenantId,
          mp_payment_id: String(payment.id ?? paymentId),
          mp_status: payment.status as string,
          mp_type: type,
          raw_payload: payment,
        });
      }
    } catch (err) {
      console.error("Webhook processing error:", err);
    }
  });

  // ── Admin middleware ────────────────────────────────────────
  async function validateAdmin(req: express.Request): Promise<{ userId: string } | null> {
    const auth = await validateJWT(req);
    if (!auth) return null;
    const { data } = await getSupabaseAdmin()
      .from("basquete_users")
      .select("issuperusuario")
      .eq("auth_id", auth.userId)
      .maybeSingle();
    if (!data?.issuperusuario) return null;
    return auth;
  }

  // ── GET /api/admin/stats ────────────────────────────────────
  app.get("/api/admin/stats", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const sb = getSupabaseAdmin();
    const [tenants, users, events] = await Promise.all([
      sb.from("tenants").select("id, status, plan_id"),
      sb.from("basquete_users").select("id", { count: "exact", head: true }),
      sb.from("subscription_events").select("id, mp_status, processed_at").order("processed_at", { ascending: false }).limit(20),
    ]);

    const all = tenants.data ?? [];
    const stats = {
      totalTenants: all.length,
      active: all.filter((t: any) => t.status === "active").length,
      pastDue: all.filter((t: any) => t.status === "past_due").length,
      cancelled: all.filter((t: any) => t.status === "cancelled").length,
      trial: all.filter((t: any) => t.status === "trial").length,
      totalUsers: users.count ?? 0,
      recentPayments: events.data ?? [],
    };
    return res.json(stats);
  });

  // ── GET /api/admin/tenants ──────────────────────────────────
  app.get("/api/admin/tenants", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { data } = await getSupabaseAdmin()
      .from("tenants")
      .select("*, plan:plans(id, name, price_brl)")
      .order("created_at", { ascending: false });

    // Buscar emails dos owners
    const tenantList = data ?? [];
    const ownerIds = [...new Set(tenantList.map((t: any) => t.owner_auth_id))];
    const emails: Record<string, string> = {};
    for (const oid of ownerIds) {
      const { data: u } = await getSupabaseAdmin().auth.admin.getUserById(oid);
      if (u?.user?.email) emails[oid] = u.user.email;
    }

    return res.json(tenantList.map((t: any) => ({ ...t, owner_email: emails[t.owner_auth_id] ?? "" })));
  });

  // ── PATCH /api/admin/tenants/:id ────────────────────────────
  app.patch("/api/admin/tenants/:id", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { id } = req.params;
    const { status, plan_id } = req.body as { status?: string; plan_id?: string };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (plan_id) update.plan_id = plan_id;

    const { error } = await getSupabaseAdmin().from("tenants").update(update).eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  // ── GET /api/admin/plans ────────────────────────────────────
  app.get("/api/admin/plans", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { data } = await getSupabaseAdmin().from("plans").select("*").order("price_brl");
    return res.json(data ?? []);
  });

  // ── PATCH /api/admin/plans/:id ──────────────────────────────
  app.patch("/api/admin/plans/:id", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { id } = req.params;
    const { is_active, price_brl, max_players, max_locations, max_events, name } = req.body as {
      is_active?: boolean; price_brl?: number; max_players?: number | null;
      max_locations?: number | null; max_events?: number | null; name?: string;
    };
    const update: Record<string, unknown> = {};
    if (is_active !== undefined) update.is_active = is_active;
    if (price_brl !== undefined) update.price_brl = price_brl;
    if (max_players !== undefined) update.max_players = max_players;
    if (max_locations !== undefined) update.max_locations = max_locations;
    if (max_events !== undefined) update.max_events = max_events;
    if (name !== undefined) update.name = name;

    const { error } = await getSupabaseAdmin().from("plans").update(update).eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  // ── CRUD /api/admin/events ──────────────────────────────────
  app.get("/api/admin/events", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { data } = await getSupabaseAdmin()
      .from("system_events")
      .select("*")
      .order("event_date", { ascending: false });
    return res.json(data ?? []);
  });

  app.post("/api/admin/events", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { title, description, event_date, event_time, type, modality, max_participants, image_url, website, status } = req.body;
    const { data, error } = await getSupabaseAdmin()
      .from("system_events")
      .insert({
        title, description, event_date, event_time: event_time || null,
        type: type || "comunicado", modality: modality || null,
        max_participants: max_participants || null,
        image_url: image_url || null, website: website || null,
        status: status || "published",
        created_by: admin.userId,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  });

  app.patch("/api/admin/events/:id", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { id } = req.params;
    const { title, description, event_date, event_time, type, modality, max_participants, image_url, website, status } = req.body;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (event_date !== undefined) update.event_date = event_date;
    if (event_time !== undefined) update.event_time = event_time || null;
    if (type !== undefined) update.type = type;
    if (modality !== undefined) update.modality = modality || null;
    if (max_participants !== undefined) update.max_participants = max_participants || null;
    if (image_url !== undefined) update.image_url = image_url || null;
    if (website !== undefined) update.website = website || null;
    if (status !== undefined) update.status = status;

    const { error } = await getSupabaseAdmin().from("system_events").update(update).eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  app.delete("/api/admin/events/:id", async (req, res) => {
    const admin = await validateAdmin(req);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    const { id } = req.params;
    const { error } = await getSupabaseAdmin().from("system_events").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  });

  // ── Vite / Static ────────────────────────────────────────
  console.log(`NODE_ENV is: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: "all" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("index.html not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
