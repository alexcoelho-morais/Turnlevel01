import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Libera requisições preflight do navegador (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!mpToken) {
      throw new Error("MP_ACCESS_TOKEN não configurado nos segredos.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);

    // =========================================================================
    // ROTA 1: WEBHOOK DO MERCADO PAGO (Avisa quando o pagamento foi aprovado)
    // =========================================================================
    if (url.searchParams.get("origem") === "webhook") {
      const body = await req.json().catch(() => ({}));
      const orderId = body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");

      if (!orderId) {
        return new Response(JSON.stringify({ recebido: true }), { status: 200 });
      }

      // Consulta a Order direto na API do Mercado Pago para confirmar que é verdadeira
      const mpCheck = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });

      if (!mpCheck.ok) {
        return new Response(JSON.stringify({ erro: "Order não encontrada" }), { status: 200 });
      }

      const orderData = await mpCheck.json();
      const status = orderData.status; // Ex: "processed" quando pago
      const userId = orderData.external_reference;

      if ((status === "processed" || status === "approved") && userId) {
        // Verifica se já não processamos esse pagamento antes
        const { data: jaPago } = await supabaseAdmin
          .from("pagamentos_passe")
          .select("id, status")
          .eq("mp_order_id", String(orderId))
          .maybeSingle();

        if (jaPago?.status !== "aprovado") {
          // Calcula 7 dias a partir de agora
          const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          // Atualiza o passe do trabalhador na tabela profiles
          await supabaseAdmin
            .from("profiles")
            .update({ passe_expira_em: expiraEm })
            .eq("id", userId);

          // Marca o pagamento como aprovado em pagamentos_passe
          await supabaseAdmin
            .from("pagamentos_passe")
            .upsert(
              {
                mp_order_id: String(orderId),
                user_id: userId,
                valor: 9.47,
                status: "aprovado",
              },
              { onConflict: "mp_order_id" }
            );
        }
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // =========================================================================
    // ROTA 2: APP DO TRABALHADOR PEDINDO PARA GERAR O PAGAMENTO DE R$ 9,47
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ erro: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ erro: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { return_url } = await req.json().catch(() => ({}));
    const webhookUrl = `${supabaseUrl}/functions/v1/passe-mercado-pago?origem=webhook`;
    const idempotencyKey = `${user.id}-${Date.now()}`;

    // Cria a Order de Checkout Pro na API de Orders do Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        total_amount: "9.47",
        external_reference: user.id,
        notification_url: webhookUrl,
        description: "Passe 7 dias de candidaturas ilimitadas - TurnLevel",
        config: {
          online: {
            callback_url: return_url || "https://turnlevel.vercel.app",
          },
        },
        transactions: {
          payments: [
            {
              amount: "9.47",
            },
          ],
        },
      }),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ erro: "Falha ao criar cobrança no Mercado Pago", detalhe: mpResult }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registra a intenção pendente na tabela pagamentos_passe
    await supabaseAdmin.from("pagamentos_passe").insert({
      user_id: user.id,
      mp_order_id: String(mpResult.id),
      valor: 9.47,
      status: "pendente",
    });

    // Retorna o link do Checkout Pro para o front-end abrir
    const checkoutUrl =
      mpResult?.type_response?.redirect_url ||
      mpResult?.init_point ||
      mpResult?.sandbox_init_point;

    return new Response(
      JSON.stringify({
        order_id: mpResult.id,
        checkout_url: checkoutUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ erro: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
