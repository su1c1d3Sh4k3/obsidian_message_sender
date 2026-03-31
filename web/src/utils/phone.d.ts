/** Normaliza telefone para formato 55 + DDD + número */
export declare function normalizePhone(raw: string): string;
/** Formata telefone para exibição: +55 31 99999-9999 */
export declare function formatPhone(phone: string): string;
/** Extrai DDD do telefone normalizado */
export declare function extractDDD(phone: string): string;
/** Extrai primeiro nome de nome completo */
export declare function extractFirstName(fullName: string): string;
//# sourceMappingURL=phone.d.ts.map