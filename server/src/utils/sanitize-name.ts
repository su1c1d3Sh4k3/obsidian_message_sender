export function sanitizeName(raw: string): { displayName: string; orgExtracted?: string } {
  // Remove emojis
  let name = raw.replace(
    /[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]/gu,
    "",
  );

  // Extrai texto entre parênteses como organização
  const orgMatch = name.match(/\(([^)]+)\)/);
  const orgExtracted = orgMatch ? orgMatch[1].trim() : undefined;
  name = name.replace(/\([^)]*\)/g, "");

  // Remove caracteres especiais do início
  name = name.replace(/^[^a-zA-ZÀ-ú]+/, "");

  // Trim e capitaliza
  name = name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { displayName: name || "Sem Nome", orgExtracted };
}
