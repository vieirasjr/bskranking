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
  teste:        "Basquete Next - Teste",
};
const PLAN_PRICES: Record<string, number> = {
  basico: 100,
  profissional: 150,
  enterprise: 200,
  avulso: 50,
  teste: 1,
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
        // Pagamento aprovado/rejeitado
        const mpRes = await mpFetch(`/v1/payments/${paymentId}`);
        const payment = await mpRes.json() as Record<string, unknown>;

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
            mp_payer_id: String((payment.payer as Record<string, unknown>)?.id ?? ""),
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
    const { is_active, price_brl, max_players, max_locations, max_events } = req.body as {
      is_active?: boolean; price_brl?: number; max_players?: number | null;
      max_locations?: number | null; max_events?: number | null;
    };
    const update: Record<string, unknown> = {};
    if (is_active !== undefined) update.is_active = is_active;
    if (price_brl !== undefined) update.price_brl = price_brl;
    if (max_players !== undefined) update.max_players = max_players;
    if (max_locations !== undefined) update.max_locations = max_locations;
    if (max_events !== undefined) update.max_events = max_events;

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
