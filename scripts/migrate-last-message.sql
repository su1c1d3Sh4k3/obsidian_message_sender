-- Add last_message_at column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- Backfill from existing campaign_messages (most recent sent_at per contact)
UPDATE contacts c
SET last_message_at = sub.max_sent
FROM (
  SELECT contact_id, MAX(sent_at) AS max_sent
  FROM campaign_messages
  WHERE status = 'sent' AND sent_at IS NOT NULL
  GROUP BY contact_id
) sub
WHERE c.id = sub.contact_id AND c.last_message_at IS NULL;
