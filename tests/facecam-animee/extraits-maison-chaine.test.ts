/**
 * BR-EXTRAITS-MAISON-b : la chaîne v4 transmet au réalisateur l'option « extraits de vos vidéos » quand ses outils la portent.
 * Chemin réel : vraie `avancerChaineV4` (pas « mise-en-scene »), faux client Claude gratuit qui capte la requête. Éteint par défaut.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { avancerChaineV4, entreeRealisateurV4, etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";

const MARQUE = "EXTRAITS DES VIDÉOS DE WILL";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const MOTS = [
  { w: "bonjour", a: 0.2, f: 0.8 },
  { w: "voici", a: 1.0, f: 1.4 },
  { w: "mon", a: 2.0, f: 2.5 },
  { w: "devis", a: 3.0, f: 3.5 },
];
const occurrences = (t: string, x: string) => t.split(x).length - 1;

/** Fait faire à la vraie chaîne son pas « mise-en-scene » ; `reponses` = requêtes captées (une par appel au réalisateur). */
async function requetes(supplement: Record<string, unknown>): Promise<RequeteRealisateur[]> {
  const vues: RequeteRealisateur[] = [];
  const outils = {
    plafondClaudeAtteint: async () => false,
    historique: async () => [],
    appelerRealisateur: async (r: RequeteRealisateur) => {
      vues.push(r);
      return { ok: false as const, message: "faux client" };
    },
    ...supplement,
  };
  const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v-1", versionId: "x", priseCle: "p", texteValide: "t" } as never), etape: "mise-en-scene", coupes: { mots: MOTS, dureeSec: 6 } as never };
  await avancerChaineV4(etat, outils as never);
  return vues;
}

describe("BR-EXTRAITS-MAISON-b : outils → message du réalisateur", () => {
  it("(a) sans extraitsMaison, puis false : message et système identiques à ceux de master, avec et sans telephoneVideo", async () => {
    for (const base of [{}, { telephoneVideo: true }]) {
      const [ref] = await requetes(base);
      const [faux] = await requetes({ ...base, extraitsMaison: false });
      expect(ref.message).not.toContain(MARQUE);
      expect(sha(faux.message)).toBe(sha(ref.message));
      expect(sha(faux.systeme)).toBe(sha(ref.systeme));
    }
  });

  it("(b) extraitsMaison: true : le message contient le bloc une fois, le système est inchangé", async () => {
    const [ref] = await requetes({});
    const vues = await requetes({ extraitsMaison: true });
    expect(vues.length).toBeGreaterThanOrEqual(1);
    for (const r of vues) {
      expect(occurrences(r.message, MARQUE)).toBe(1);
      expect(sha(r.systeme)).toBe(sha(ref.systeme));
      expect(r.systeme).not.toContain(MARQUE);
    }
  });

  it("(c) entreeRealisateurV4 : option absente = objet de master ; « true » texte = pas de clé", () => {
    const etat = { demande: { texteValide: "t" }, coupes: { mots: MOTS, dureeSec: 6 }, cadrage: undefined } as never;
    const base = entreeRealisateurV4(etat, {});
    expect("extraitsMaison" in base).toBe(false);
    expect("extraitsMaison" in entreeRealisateurV4(etat, { extraitsMaison: "true" } as never)).toBe(false);
    expect("extraitsMaison" in entreeRealisateurV4(etat, { extraitsMaison: false })).toBe(false);
    expect(entreeRealisateurV4(etat, { extraitsMaison: true }).extraitsMaison).toBe(true);
  });
});
