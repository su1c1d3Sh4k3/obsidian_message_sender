export interface SanitizePhoneResult {
  phone: string;
  isValid: boolean;
  warnings: string[];
}

export function sanitizePhone(raw: string): SanitizePhoneResult {
  const warnings: string[] = [];

  // Remove tudo que não é número
  let clean = raw.replace(/\D/g, "");

  // Remove zero à esquerda (ex: 031...)
  if (clean.startsWith("0")) clean = clean.substring(1);

  // Adiciona DDI 55 se não tem
  if (!clean.startsWith("55")) {
    clean = "55" + clean;
  }

  // Agora o número deve ser: 55 + DDD(2) + Número(8-9) = 12-13 dígitos
  const withoutDDI = clean.substring(2); // remove "55"

  // Sem DDD: menos de 10 dígitos após DDI (só o número local, sem DDD)
  if (withoutDDI.length <= 9) {
    warnings.push("DDD não encontrado");
  }

  // Quantidade de dígitos incorreta (não é 12 nem 13 total)
  if (clean.length < 12 || clean.length > 13) {
    warnings.push("Quantidade de dígitos incorreta, verifique para evitar erros");
  }

  const isValid = /^55\d{10,11}$/.test(clean);

  return { phone: clean, isValid, warnings };
}
