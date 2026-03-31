export function sanitizePhone(raw: string): { phone: string; isValid: boolean } {
  // Remove tudo que não é número
  let clean = raw.replace(/\D/g, "");

  // Remove zero à esquerda
  if (clean.startsWith("0")) clean = clean.substring(1);

  // Adiciona DDI 55 se não tem
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }

  // Valida: DDI(2) + DDD(2) + Número(8-9) = 12-13 dígitos
  const isValid = /^55\d{10,11}$/.test(clean);

  return { phone: clean, isValid };
}
