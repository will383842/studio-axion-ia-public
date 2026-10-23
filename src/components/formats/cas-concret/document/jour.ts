/** Date lisible : « 12/10/2026 ». */
export const jourFrancais = (iso: string): string => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
