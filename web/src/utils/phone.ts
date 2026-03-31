/** Normaliza telefone para formato 55 + DDD + número */
export function normalizePhone(raw: string): string {
  let clean = raw.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return clean;
}

/** Formata telefone para exibição: +55 31 99999-9999 */
export function formatPhone(phone: string): string {
  const clean = normalizePhone(phone);
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return `+${clean}`;
}

/** Extrai DDD do telefone normalizado */
export function extractDDD(phone: string): string {
  const clean = normalizePhone(phone);
  if (clean.startsWith("55") && clean.length >= 4) {
    return clean.slice(2, 4);
  }
  return "";
}

/** Extrai primeiro nome de nome completo */
export function extractFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "";
}
