/**
 * L0-16 · Contrôle de production, LECTURE SEULE (Réglages › Connexions) : quelles clés sont posées sur le serveur
 * (oui / non, jamais la clé, pas même ses derniers caractères) et la valeur des interrupteurs d'envoi.
 * Aucun appel réseau, aucune écriture. L'environnement et la lecture des paramètres sont injectés (doublures en test).
 */
export type Env = Record<string, string | undefined>;
export type LecteurParametre = (id: string) => Promise<unknown>;

export const CLES_PRODUCTION = [
  { variable: "HEYGEN_API_KEY", libelle: "HeyGen" },
  { variable: "ELEVENLABS_API_KEY", libelle: "ElevenLabs" },
  { variable: "FAL_KEY", libelle: "fal.ai" },
  { variable: "ANTHROPIC_API_KEY", libelle: "Claude" },
  { variable: "ZERNIO_API_KEY", libelle: "Zernio" },
] as const;

/** `parDefaut` : valeur quand le réglage est absent ou n'est pas un booléen (arrêt global ouvert, calendrier fermé). */
export const INTERRUPTEURS_PRODUCTION = [
  { cle: "zernio.envoi_autorise", libelle: "Envoi vers Zernio autorisé (arrêt global)", parDefaut: true },
  { cle: "zernio.envoi_calendrier_autorise", libelle: "Envoi des publications du calendrier", parDefaut: false },
] as const;

export type EtatProduction = {
  cles: { variable: string; libelle: string; posee: boolean }[];
  interrupteurs: { cle: string; libelle: string; allume: boolean }[];
};

export async function etatProduction(env: Env, lire: LecteurParametre): Promise<EtatProduction> {
  const cles = CLES_PRODUCTION.map((c) => ({ variable: c.variable, libelle: c.libelle, posee: (env[c.variable] ?? "").trim() !== "" }));
  const interrupteurs: EtatProduction["interrupteurs"] = [];
  for (const i of INTERRUPTEURS_PRODUCTION) {
    let allume: boolean = i.parDefaut;
    try {
      const v = await lire(i.cle);
      if (typeof v === "boolean") allume = v;
    } catch {
      allume = false; // lecture impossible : on affiche « éteint », sans le message d'erreur
    }
    interrupteurs.push({ cle: i.cle, libelle: i.libelle, allume });
  }
  return { cles, interrupteurs };
}
