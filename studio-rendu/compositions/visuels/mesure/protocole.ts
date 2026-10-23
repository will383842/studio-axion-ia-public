/**
 * Protocole de mesure d'un rendu VisuelPage (SEC-02) : la page écrit UNE ligne dans la console du navigateur, l'opération
 * la lit par `onBrowserLog`. La ligne porte le NONCE tiré par l'opération pour CE rendu : toute autre ligne est ignorée.
 * Module PUR (importé par la composition et par l'opération).
 */
export const PREFIXE_MESURE = "AXION-MESURE";

/** Identifiant de la composition de mesure (module pur : importable par l'opération sans charger les polices). */
export const ID_COMPOSITION_MESURE = "VisuelPageMesuree";

export type MesuresPage = Record<string, number>;

export function formaterMesure(nonce: string, mesures: MesuresPage): string {
  return `${PREFIXE_MESURE} ${nonce} ${JSON.stringify(mesures)}`;
}

/** Mesures de la PREMIÈRE ligne lisible portant le bon nonce ET les deux clés `debordements` et `taillePoliceMin`, ou `null` (mesure absente = échec côté opération). */
export function extraireMesure(lignes: readonly string[], nonce: string): MesuresPage | null {
  const debut = `${PREFIXE_MESURE} ${nonce} `;
  for (const ligne of lignes) {
    if (!nonce || !ligne.startsWith(debut)) continue;
    try {
      const brut: unknown = JSON.parse(ligne.slice(debut.length));
      if (typeof brut !== "object" || brut === null || Array.isArray(brut)) continue;
      const m = brut as Record<string, unknown>;
      if (typeof m.debordements !== "number" || typeof m.taillePoliceMin !== "number") continue;
      if (Object.values(m).every((v) => typeof v === "number" && Number.isFinite(v))) return m as MesuresPage;
    } catch {
      // ligne illisible : ignorée
    }
  }
  return null;
}
