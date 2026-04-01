import { supabaseAdmin } from "../lib/supabase.js";
import { uzapiFetch } from "../lib/uzapi.js";
import { renderMessage } from "../utils/spintax.js";

/**
 * Birthday dispatcher — checks every 60s if it's time to send birthday greetings.
 * For each tenant with an active birthday campaign, at the configured send_time,
 * it finds all contacts whose birth_date matches today's month/day and dispatches
 * the campaign message to each.
 */
export function startBirthdayChecker() {
  async function check() {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const todayMM_DD = today.slice(5); // MM-DD

      // Find active birthday campaigns whose send_time matches current minute
      const { data: campaigns } = await supabaseAdmin
        .from("birthday_campaigns")
        .select("*")
        .eq("is_active", true)
        .eq("send_time", currentTime);

      if (!campaigns?.length) return;

      for (const campaign of campaigns) {
        // Skip if already ran today
        if (campaign.last_run_date === today) continue;

        console.log(`[birthday] Running birthday campaign "${campaign.name}" for tenant ${campaign.tenant_id}`);

        // Mark as running today immediately to prevent double-execution
        await supabaseAdmin
          .from("birthday_campaigns")
          .update({ last_run_date: today })
          .eq("id", campaign.id);

        // Find today's birthday contacts for this tenant
        const { data: allContacts } = await supabaseAdmin
          .from("contacts")
          .select("id, phone, first_name, last_name, display_name, organization, city, is_valid, is_blacklisted, birth_date")
          .eq("tenant_id", campaign.tenant_id)
          .eq("is_valid", true)
          .eq("is_blacklisted", false)
          .not("birth_date", "is", null);

        if (!allContacts?.length) continue;

        const birthdayContacts = allContacts.filter((c: any) => {
          const bd = String(c.birth_date);
          return bd.slice(5) === todayMM_DD;
        });

        if (!birthdayContacts.length) {
          console.log(`[birthday] No birthdays today for tenant ${campaign.tenant_id}`);
          continue;
        }

        console.log(`[birthday] Found ${birthdayContacts.length} birthday contact(s)`);

        // Filter out blacklisted phones
        const { data: blacklisted } = await supabaseAdmin
          .from("blacklist")
          .select("phone")
          .eq("tenant_id", campaign.tenant_id);
        const blacklistedPhones = new Set((blacklisted ?? []).map((b: any) => b.phone));
        const contacts = birthdayContacts.filter((c: any) => !blacklistedPhones.has(c.phone));

        if (!contacts.length) continue;

        // Resolve senders
        const senderIds: string[] = campaign.sender_ids?.length
          ? campaign.sender_ids
          : campaign.sender_id
            ? [campaign.sender_id]
            : [];

        if (!senderIds.length) {
          console.error(`[birthday] No senders configured for campaign ${campaign.id}`);
          continue;
        }

        const { data: senders } = await supabaseAdmin
          .from("senders")
          .select("*")
          .in("id", senderIds)
          .eq("tenant_id", campaign.tenant_id)
          .eq("status", "connected");

        if (!senders?.length) {
          console.error(`[birthday] No connected senders for campaign ${campaign.id}`);
          continue;
        }

        // Send to each birthday contact with delay
        let sentCount = 0;
        for (let i = 0; i < contacts.length; i++) {
          const contact = contacts[i];
          const sender = senders[i % senders.length];

          try {
            await sendBirthdayMessage(campaign, sender, contact);
            sentCount++;
          } catch (err) {
            console.error(`[birthday] Failed to send to ${contact.phone}:`, err);
          }

          // Delay between messages
          if (i < contacts.length - 1) {
            const delayMin = (campaign.delay_min ?? 15) * 1000;
            const delayMax = (campaign.delay_max ?? 45) * 1000;
            const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        // Update total_sent
        await supabaseAdmin
          .from("birthday_campaigns")
          .update({ total_sent: (campaign.total_sent ?? 0) + sentCount })
          .eq("id", campaign.id);

        console.log(`[birthday] Sent ${sentCount}/${contacts.length} birthday messages for campaign ${campaign.id}`);
      }
    } catch (err) {
      console.error("[birthday] Check error:", err);
    }
  }

  // Check every 60 seconds
  check();
  setInterval(check, 60_000);
  console.log("[birthday] Birthday checker started (every 60s)");
}

async function sendBirthdayMessage(campaign: any, sender: any, contact: any) {
  const contactVars: Record<string, string | undefined> = {
    primeiro_nome: contact.first_name || contact.display_name?.split(" ")[0],
    nome_completo: contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    telefone: contact.phone,
    cidade: contact.city || undefined,
    empresa: contact.organization || undefined,
  };

  // Parse message blocks
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

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "text" && block.content) {
      const text = renderMessage(block.content, contactVars, campaign.use_spintax ?? false);
      await uzapiFetch("/send/text", {
        token: sender.uzapi_token,
        body: { number: contact.phone, text },
      });
    } else if (block.type === "image" && block.url) {
      const caption = block.caption
        ? renderMessage(block.caption, contactVars, campaign.use_spintax ?? false)
        : "";
      await uzapiFetch("/send/media", {
        token: sender.uzapi_token,
        body: { number: contact.phone, file: block.url, type: "image", text: caption },
      });
    } else if (block.type === "audio" && block.url) {
      await uzapiFetch("/send/media", {
        token: sender.uzapi_token,
        body: { number: contact.phone, file: block.url, type: "ptt" },
      });
    } else if (block.type === "document" && block.url) {
      const caption = block.caption
        ? renderMessage(block.caption, contactVars, campaign.use_spintax ?? false)
        : "";
      await uzapiFetch("/send/media", {
        token: sender.uzapi_token,
        body: { number: contact.phone, file: block.url, type: "document", text: caption },
      });
    }

    // Small delay between blocks
    if (i < blocks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    }
  }
}
