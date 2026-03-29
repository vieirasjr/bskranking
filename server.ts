import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

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

// ── MP helpers ───────────────────────────────────────────────
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN ?? "";
const MP_API = "https://api.mercadopago.com";

const PLAN_NAMES: Record<string, string> = {
  basico:       "Basquete Next - Plano Básico",
  profissional: "Basquete Next - Plano Profissional",
  enterprise:   "Basquete Next - Plano Enterprise",
  avulso:       "Basquete Next - Evento Avulso",
};
const PLAN_PRICES: Record<string, number> = {
  basico: 100,
  profissional: 150,
  enterprise: 200,
  avulso: 50,
};
// Planos com expiração por tempo (horas) em vez de ciclo mensal
const PLAN_EXPIRY_HOURS: Record<string, number> = {
  avulso: 72,
};

async function mpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  return res;
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

    const preference = {
      items: [{
        title: PLAN_NAMES[planId],
        quantity: 1,
        currency_id: "BRL",
        unit_price: PLAN_PRICES[planId],   // valor em R$ (100, 150, 200)
      }],
      payer: {
        email: (req.body.email as string | undefined) ?? undefined,
      },
      back_urls: {
        success: `${baseUrl}/dashboard/assinatura?mp=success&plan=${planId}`,
        failure: `${baseUrl}/dashboard/assinatura?mp=failure`,
        pending: `${baseUrl}/dashboard/assinatura?mp=pending`,
      },
      ...(isPublicUrl && { auto_return: "approved" }),
      external_reference: `${tenant.id}|${planId}`,
      notification_url: `${baseUrl}/api/webhook/mercadopago?source_news=webhooks`,
      statement_descriptor: "BASQUETE NEXT",
      payment_methods: {
        installments: 1,
      },
    };

    const mpRes = await mpFetch("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preference),
    });
    const mpData = await mpRes.json() as Record<string, unknown>;

    if (!mpRes.ok) {
      console.error("MP create-preference error:", mpData);
      return res.status(502).json({ error: "Erro ao criar preferência de pagamento." });
    }

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

    const payload = {
      ...formData,
      transaction_amount: PLAN_PRICES[planId],
      description: `Basquete Next - ${PLAN_NAMES[planId]}`,
      external_reference: `${tenant.id}|${planId}`,
      statement_descriptor: "BASQUETE NEXT",
      installments: 1,
    };

    const mpRes = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `${tenant.id}-${planId}-${Date.now()}` } as Record<string, string>,
      body: JSON.stringify(payload),
    });

    const payment = await mpRes.json() as Record<string, unknown>;

    if (!mpRes.ok) {
      console.error("MP process-payment error:", JSON.stringify(payment, null, 2));
      const cause = (payment.cause as Array<{ description: string }> | undefined)?.[0]?.description;
      return res.status(502).json({
        error: cause ?? (payment.message as string) ?? "Erro ao processar pagamento.",
        mp_error: payment.error,
        mp_status: payment.status,
      });
    }

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
        mp_payer_id: String((payment.payer as Record<string, unknown>)?.id ?? ""),
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

    return res.json({ status: payment.status, id: payment.id });
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

    const { data: userRow } = await getSupabaseAdmin().auth.admin.getUserById(auth.userId);
    const rawEmail = payerEmail ?? userRow?.user?.email ?? "";
    // Emails @testuser.com são contas de vendedor no MP — usar fallback como payer
    const email = rawEmail.endsWith("@testuser.com")
      ? "comprador@basquetenext.com"
      : (rawEmail || "comprador@basquetenext.com");

    const mpRes = await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": `pix-${tenant.id}-${planId}-${Date.now()}` } as Record<string, string>,
      body: JSON.stringify({
        transaction_amount: PLAN_PRICES[planId],
        payment_method_id: "pix",
        description: PLAN_NAMES[planId],
        external_reference: `${tenant.id}|${planId}`,
        payer: { email },
      }),
    });

    const payment = await mpRes.json() as Record<string, unknown>;

    if (!mpRes.ok) {
      console.error("MP create-pix error:", JSON.stringify(payment, null, 2));
      const cause = (payment.cause as Array<{ description: string }> | undefined)?.[0]?.description;
      return res.status(502).json({ error: cause ?? (payment.message as string) ?? "Erro ao gerar PIX." });
    }

    const txData = (payment.point_of_interaction as Record<string, unknown>)
      ?.transaction_data as Record<string, unknown> | undefined;

    return res.json({
      paymentId: payment.id,
      status: payment.status,
      qr_code: txData?.qr_code,
      qr_code_base64: txData?.qr_code_base64,
      ticket_url: txData?.ticket_url,
    });
  });

  // ── GET /api/mp/payment-status/:paymentId ───────────────
  app.get("/api/mp/payment-status/:paymentId", async (req, res) => {
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { paymentId } = req.params;
    const mpRes = await mpFetch(`/v1/payments/${paymentId}`);
    const payment = await mpRes.json() as Record<string, unknown>;

    if (!mpRes.ok) return res.status(502).json({ error: "Erro ao consultar pagamento." });

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
  });

  // ── POST /api/mp/simulate-pix/:paymentId (sandbox only) ─
  app.post("/api/mp/simulate-pix/:paymentId", async (req, res) => {
    if (!MP_ACCESS_TOKEN.startsWith("TEST-")) {
      return res.status(403).json({ error: "Simulação disponível apenas em sandbox." });
    }
    const auth = await validateJWT(req);
    if (!auth) return res.status(401).json({ error: "Não autorizado." });

    const { paymentId } = req.params;
    const mpRes = await mpFetch(`/v1/payments/${paymentId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "approved", status_detail: "accredited" }),
    });
    const data = await mpRes.json() as Record<string, unknown>;
    if (!mpRes.ok) {
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

    const mpRes = await mpFetch(`/preapproval/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!mpRes.ok) {
      return res.status(502).json({ error: "Erro ao cancelar no Mercado Pago." });
    }

    await getSupabaseAdmin()
      .from("tenants")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", tenant.id);

    return res.json({ ok: true });
  });

  // ── GET /api/webhook/mercadopago ─────────────────────────
  // MP valida o endpoint com GET antes de enviar notificações
  app.get("/api/webhook/mercadopago", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // ── POST /api/webhook/mercadopago ────────────────────────
  // Recebe notificações do MP (pagamentos, assinaturas)
  app.post("/api/webhook/mercadopago", async (req, res) => {
    // Responde 200 imediatamente para o MP não retentar
    res.status(200).json({ ok: true });

    try {
      const { type, data } = req.body as { type: string; data: { id: string } };

      if (type === "payment") {
        // Checkout Pro — pagamento aprovado/rejeitado
        const mpRes = await mpFetch(`/v1/payments/${data.id}`);
        const payment = await mpRes.json() as Record<string, unknown>;

        const externalRef = (payment.external_reference as string) ?? "";
        const [tenantId, planId] = externalRef.split("|");
        if (!tenantId) return;

        // Calcula próxima cobrança (30 dias a partir de hoje)
        const nextCharge = new Date();
        nextCharge.setDate(nextCharge.getDate() + 30);

        if (payment.status === "approved") {
          await getSupabaseAdmin().from("tenants").update({
            status: "active",
            plan_id: planId ?? undefined,
            mp_payer_id: String((payment.payer as Record<string, unknown>)?.id ?? ""),
            current_period_ends_at: nextCharge.toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", tenantId);
        } else if (payment.status === "rejected" || payment.status === "cancelled") {
          await getSupabaseAdmin().from("tenants").update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("id", tenantId);
        }

        await getSupabaseAdmin().from("subscription_events").insert({
          tenant_id: tenantId,
          mp_payment_id: String(payment.id ?? data.id),
          mp_status: payment.status as string,
          mp_type: type,
          raw_payload: payment,
        });
      }
    } catch (err) {
      console.error("Webhook processing error:", err);
    }
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
