import { supabaseAdmin } from "../lib/supabase.js";
import { uzapiFetch } from "../lib/uzapi.js";
import { renderMessage } from "../utils/spintax.js";

// ── In-memory tracking ──────────────────────────────
interface RunningCampaign {
  status: "running" | "paused" | "cancelled";
  timers: ReturnType<typeof setTimeout>[];
}

const activeCampaigns = new Map<string, RunningCampaign>();

// ── Public API ──────────────────────────────────────

export async function startCampaign(campaignId: string, tenantId: string) {
  // Load campaign
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) throw new Error("Campanha não encontrada");

  // Resolve sender IDs
  const senderIds: string[] = campaign.sender_ids?.length
    ? campaign.sender_ids
    : campaign.sender_id
      ? [campaign.sender_id]
      : [];

  if (senderIds.length === 0) throw new Error("Nenhum remetente configurado");

  // Load connected senders
  const { data: senders } = await supabaseAdmin
    .from("senders")
    .select("*")
    .in("id", senderIds)
    .eq("tenant_id", tenantId)
    .eq("status", "connected");

  if (!senders?.length) throw new Error("Nenhum remetente conectado");

  // Resolve contacts (only on first start, not resume)
  const existingMessages = await supabaseAdmin
    .from("campaign_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (!existingMessages.count) {
    await populateMessages(campaignId, tenantId, campaign, senders);
  }

  // Start sending
  const rc: RunningCampaign = { status: "running", timers: [] };
  activeCampaigns.set(campaignId, rc);

  // Launch one send loop per sender
  for (const sender of senders) {
    scheduleSenderLoop(campaignId, campaign, sender, rc);
  }

  console.log(`[dispatcher] Campaign ${campaignId} started with ${senders.length} sender(s)`);
}

export async function resumeCampaign(campaignId: string, tenantId: string) {
  // Similar to start but skips populate
  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campanha não encontrada");

  const senderIds: string[] = campaign.sender_ids?.length
    ? campaign.sender_ids
    : campaign.sender_id
      ? [campaign.sender_id]
      : [];

  const { data: senders } = await supabaseAdmin
    .from("senders")
    .select("*")
    .in("id", senderIds)
    .eq("tenant_id", tenantId)
    .eq("status", "connected");

  if (!senders?.length) throw new Error("Nenhum remetente conectado");

  // Reset any stuck 'sending' messages back to 'pending'
  await supabaseAdmin
    .from("campaign_messages")
    .update({ status: "pending" })
    .eq("campaign_id", campaignId)
    .eq("status", "sending");

  const rc: RunningCampaign = { status: "running", timers: [] };
  activeCampaigns.set(campaignId, rc);

  for (const sender of senders) {
    scheduleSenderLoop(campaignId, campaign, sender, rc);
  }

  console.log(`[dispatcher] Campaign ${campaignId} resumed`);
}

export function pauseCampaign(campaignId: string) {
  const rc = activeCampaigns.get(campaignId);
  if (rc) {
    rc.status = "paused";
    rc.timers.forEach(clearTimeout);
    rc.timers.length = 0;
    activeCampaigns.delete(campaignId);
  }
  console.log(`[dispatcher] Campaign ${campaignId} paused`);
}

export async function cancelCampaign(campaignId: string) {
  pauseCampaign(campaignId);

  // Mark remaining pending messages as skipped
  await supabaseAdmin
    .from("campaign_messages")
    .update({ status: "skipped" })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "sending"]);

  console.log(`[dispatcher] Campaign ${campaignId} cancelled`);
}

// ── Scheduled campaign checker (runs every 30s) ─────
export function startScheduleChecker() {
  async function check() {
    try {
      const now = new Date().toISOString();
      const { data: campaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id, tenant_id, name")
        .eq("status", "scheduled")
        .lte("scheduled_at", now);

      if (!campaigns?.length) return;

      for (const campaign of campaigns) {
        console.log(`[scheduler] Starting scheduled campaign: ${campaign.name} (${campaign.id})`);

        await supabaseAdmin
          .from("campaigns")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("id", campaign.id);

        startCampaign(campaign.id, campaign.tenant_id).catch((err) => {
          console.error(`[scheduler] Failed to start campaign ${campaign.id}:`, err);
          supabaseAdmin.from("campaigns").update({ status: "failed" }).eq("id", campaign.id);
        });
      }
    } catch (err) {
      console.error("[scheduler] Check error:", err);
    }
  }

  // Check immediately, then every 30 seconds
  check();
  setInterval(check, 30_000);
  console.log("[scheduler] Schedule checker started (every 30s)");
}

// ── Recover on server restart ───────────────────────
export async function recoverRunningCampaigns() {
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, tenant_id")
    .eq("status", "running");

  if (!campaigns?.length) return;

  console.log(`[dispatcher] Recovering ${campaigns.length} running campaign(s)`);

  // Reset stuck 'sending' messages
  for (const c of campaigns) {
    await supabaseAdmin
      .from("campaign_messages")
      .update({ status: "pending" })
      .eq("campaign_id", c.id)
      .eq("status", "sending");
  }

  for (const c of campaigns) {
    try {
      await resumeCampaign(c.id, c.tenant_id);
    } catch (err) {
      console.error(`[dispatcher] Failed to recover campaign ${c.id}:`, err);
    }
  }
}

// ── Internal ────────────────────────────────────────

async function populateMessages(
  campaignId: string,
  tenantId: string,
  campaign: any,
  senders: any[],
) {
  // Resolve contacts based on target type
  let contacts: any[] = [];

  if (campaign.target_type === "list" && campaign.target_list_id) {
    const { data } = await supabaseAdmin
      .from("list_contacts")
      .select("contact_id, contacts!inner(id, phone, first_name, last_name, display_name, organization, city, is_blacklisted, is_valid)")
      .eq("list_id", campaign.target_list_id);
    contacts = (data ?? [])
      .map((lc: any) => lc.contacts)
      .filter((c: any) => c && c.is_valid && !c.is_blacklisted);
  } else if (campaign.target_type === "tag" && campaign.target_tag_id) {
    const { data } = await supabaseAdmin
      .from("contact_tags")
      .select("contact_id, contacts!inner(id, phone, first_name, last_name, display_name, organization, city, is_blacklisted, is_valid)")
      .eq("tag_id", campaign.target_tag_id);
    contacts = (data ?? [])
      .map((ct: any) => ct.contacts)
      .filter((c: any) => c && c.is_valid && !c.is_blacklisted);
  } else if (campaign.target_type === "filter") {
    // Simple filter: get all valid contacts for tenant
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, phone, first_name, last_name, display_name, organization, city, is_blacklisted, is_valid")
      .eq("tenant_id", tenantId)
      .eq("is_valid", true)
      .eq("is_blacklisted", false);
    contacts = data ?? [];
  }

  // Filter out blacklisted phones
  const { data: blacklisted } = await supabaseAdmin
    .from("blacklist")
    .select("phone")
    .eq("tenant_id", tenantId);
  const blacklistedPhones = new Set((blacklisted ?? []).map((b: any) => b.phone));
  contacts = contacts.filter((c: any) => !blacklistedPhones.has(c.phone));

  if (contacts.length === 0) {
    throw new Error("Nenhum contato válido encontrado para esta campanha");
  }

  // Round-robin: assign contacts to senders
  const rows = contacts.map((contact: any, idx: number) => {
    const sender = senders[idx % senders.length];
    return {
      campaign_id: campaignId,
      contact_id: contact.id,
      sender_id: sender.id,
      phone: contact.phone,
      contact_name: contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null,
      status: "pending",
      queued_at: new Date().toISOString(),
    };
  });

  // Insert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabaseAdmin.from("campaign_messages").insert(batch);
    if (error) throw new Error(`Erro ao popular fila: ${error.message}`);
  }

  // Update total_contacts
  await supabaseAdmin
    .from("campaigns")
    .update({ total_contacts: contacts.length })
    .eq("id", campaignId);

  console.log(`[dispatcher] Populated ${contacts.length} messages for campaign ${campaignId}`);
}

function scheduleSenderLoop(
  campaignId: string,
  campaign: any,
  sender: any,
  rc: RunningCampaign,
) {
  async function sendNext() {
    if (rc.status !== "running") return;

    // Claim next pending message for this sender
    const { data: messages } = await supabaseAdmin
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("sender_id", sender.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    const msg = messages?.[0];
    if (!msg) {
      // No more messages for this sender — check if campaign is done
      await checkCampaignCompletion(campaignId);
      return;
    }

    // Mark as sending
    await supabaseAdmin
      .from("campaign_messages")
      .update({ status: "sending" })
      .eq("id", msg.id)
      .eq("status", "pending"); // optimistic lock

    // Check blacklist before sending
    const { data: blocked } = await supabaseAdmin
      .from("blacklist")
      .select("id")
      .eq("phone", msg.phone)
      .limit(1);

    if (blocked?.length) {
      await supabaseAdmin
        .from("campaign_messages")
        .update({ status: "skipped", error_message: "Blacklist/opt-out" })
        .eq("id", msg.id);
      // Schedule next immediately
      const timer = setTimeout(sendNext, 100);
      rc.timers.push(timer);
      return;
    }

    // Render message with contact data
    const contactVars: Record<string, string | undefined> = {
      primeiro_nome: msg.contact_name?.split(" ")[0],
      nome_completo: msg.contact_name ?? undefined,
      telefone: msg.phone,
    };

    // Load full contact for more variables
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("first_name, last_name, display_name, organization, city")
      .eq("id", msg.contact_id)
      .single();

    if (contact) {
      contactVars.primeiro_nome = contact.first_name || contactVars.primeiro_nome;
      contactVars.nome_completo = contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contactVars.nome_completo;
      contactVars.cidade = contact.city || undefined;
      contactVars.empresa = contact.organization || undefined;
    }

    // Parse message blocks (multi-block or single text)
    let blocks: { type: string; content?: string; url?: string; caption?: string }[] = [];

    if (campaign.message_type === "multi") {
      try {
        blocks = JSON.parse(campaign.message_body);
      } catch {
        blocks = [{ type: "text", content: campaign.message_body }];
      }
    } else {
      blocks = [{ type: "text", content: campaign.message_body }];
    }

    // Send all blocks sequentially for this contact
    const renderedParts: string[] = [];
    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.type === "text" && block.content) {
          const renderedText = renderMessage(block.content, contactVars, campaign.use_spintax ?? false);
          renderedParts.push(renderedText);
          await uzapiFetch("/send/text", {
            token: sender.uzapi_token,
            body: { number: msg.phone, text: renderedText },
          });
        } else if (block.type === "image" && block.url) {
          const caption = block.caption
            ? renderMessage(block.caption, contactVars, campaign.use_spintax ?? false)
            : "";
          renderedParts.push(`[imagem] ${caption}`);
          await uzapiFetch("/send/media", {
            token: sender.uzapi_token,
            body: { number: msg.phone, file: block.url, type: "image", text: caption },
          });
        } else if (block.type === "audio" && block.url) {
          renderedParts.push("[áudio]");
          await uzapiFetch("/send/media", {
            token: sender.uzapi_token,
            body: { number: msg.phone, file: block.url, type: "ptt" },
          });
        } else if (block.type === "document" && block.url) {
          const caption = block.caption
            ? renderMessage(block.caption, contactVars, campaign.use_spintax ?? false)
            : "";
          renderedParts.push(`[documento] ${caption}`);
          await uzapiFetch("/send/media", {
            token: sender.uzapi_token,
            body: { number: msg.phone, file: block.url, type: "document", text: caption },
          });
        }

        // Small delay between blocks for same contact (1-2s)
        if (i < blocks.length - 1) {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
        }
      }

      await supabaseAdmin
        .from("campaign_messages")
        .update({
          status: "sent",
          message_rendered: renderedParts.join(" | "),
          sent_at: new Date().toISOString(),
        })
        .eq("id", msg.id);

      // Increment sent_count
      const { data: curr } = await supabaseAdmin
        .from("campaigns")
        .select("sent_count")
        .eq("id", campaignId)
        .single();
      await supabaseAdmin
        .from("campaigns")
        .update({ sent_count: (curr?.sent_count ?? 0) + 1 })
        .eq("id", campaignId);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      await supabaseAdmin
        .from("campaign_messages")
        .update({
          status: "failed",
          message_rendered: renderedParts.join(" | ") || campaign.message_body,
          error_message: errorMsg,
          failed_at: new Date().toISOString(),
        })
        .eq("id", msg.id);

      const { data: curr } = await supabaseAdmin
        .from("campaigns")
        .select("failed_count")
        .eq("id", campaignId)
        .single();
      await supabaseAdmin
        .from("campaigns")
        .update({ failed_count: (curr?.failed_count ?? 0) + 1 })
        .eq("id", campaignId);
    }

    // Schedule next with random delay
    if (rc.status !== "running") return;

    const delayMin = (campaign.delay_min ?? 15) * 1000;
    const delayMax = (campaign.delay_max ?? 45) * 1000;
    const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

    const timer = setTimeout(sendNext, delay);
    rc.timers.push(timer);
  }

  // Start first send immediately
  const timer = setTimeout(sendNext, 0);
  rc.timers.push(timer);
}

async function checkCampaignCompletion(campaignId: string) {
  const { count } = await supabaseAdmin
    .from("campaign_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "sending"]);

  if (count === 0) {
    const completedAt = new Date().toISOString();
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: completedAt,
      })
      .eq("id", campaignId);

    activeCampaigns.delete(campaignId);
    console.log(`[dispatcher] Campaign ${campaignId} completed`);

    // Send notification if enabled
    await sendCompletionNotification(campaignId).catch((err) => {
      console.error(`[dispatcher] Notification error:`, err);
    });
  }
}

async function sendCompletionNotification(campaignId: string) {
  // Load campaign with tenant
  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("name, tenant_id, total_contacts, sent_count, failed_count, started_at, completed_at")
    .eq("id", campaignId)
    .single();

  if (!campaign) return;

  // Check tenant notification settings
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("settings")
    .eq("id", campaign.tenant_id)
    .single();

  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  if (!settings.notify_enabled || !settings.notify_phone || !settings.notify_sender_id) return;

  // Get the sender to use for notification
  const { data: sender } = await supabaseAdmin
    .from("senders")
    .select("uzapi_token, status")
    .eq("id", settings.notify_sender_id as string)
    .eq("status", "connected")
    .single();

  if (!sender) return;

  // Calculate duration
  let duration = "—";
  if (campaign.started_at && campaign.completed_at) {
    const ms = new Date(campaign.completed_at).getTime() - new Date(campaign.started_at).getTime();
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    duration = minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
  }

  const skipped = campaign.total_contacts - campaign.sent_count - campaign.failed_count;
  const successRate = campaign.total_contacts > 0
    ? ((campaign.sent_count / campaign.total_contacts) * 100).toFixed(1)
    : "0";

  const text = [
    `📊 *Relatório de Campanha*`,
    ``,
    `*Campanha:* ${campaign.name}`,
    `*Status:* Finalizada ✅`,
    ``,
    `📈 *Resultados:*`,
    `• Total de contatos: ${campaign.total_contacts}`,
    `• Enviadas com sucesso: ${campaign.sent_count} ✅`,
    `• Erros no envio: ${campaign.failed_count} ❌`,
    skipped > 0 ? `• Puladas (blacklist): ${skipped} ⏭️` : null,
    `• Taxa de sucesso: ${successRate}%`,
    ``,
    `⏱️ *Duração:* ${duration}`,
    `🕐 *Início:* ${campaign.started_at ? new Date(campaign.started_at).toLocaleString("pt-BR") : "—"}`,
    `🕐 *Término:* ${campaign.completed_at ? new Date(campaign.completed_at).toLocaleString("pt-BR") : "—"}`,
  ].filter(Boolean).join("\n");

  try {
    await uzapiFetch("/send/text", {
      token: sender.uzapi_token,
      body: { number: settings.notify_phone as string, text },
    });
    console.log(`[dispatcher] Notification sent to ${settings.notify_phone}`);
  } catch (err) {
    console.error(`[dispatcher] Failed to send notification:`, err);
  }
}
