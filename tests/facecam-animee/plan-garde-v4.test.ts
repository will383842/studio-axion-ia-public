/**
 * FACE CAMÉRA ANIMÉE v4 — plan d'Opus GARDÉ (19/10) : dès le 2ᵉ essai, si les seules erreurs sont D14 ou D2a et que le plan est rendable ;
 * tout autre défaut (V6b, D15a…) renvoie à la version simple. `verifierPlan` est simulé pour isoler la règle de décision.
 */
import { describe, expect, it, vi } from "vitest";
import { PHRASE_REALISATEUR_REFUSE, realiser, type EntreeRealisateur, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { roleRealisateurV4 } from "@/moteurs/montage-facecam-animee/realisateur/role-v4";

const verdict = vi.hoisted(() => ({ erreurs: [] as string[], rendable: true }));
vi.mock("@/moteurs/montage-facecam-animee/realisateur/regles", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-facecam-animee/realisateur/regles")>();
  return { ...m, verifierPlan: (...a: Parameters<typeof m.verifierPlan>) => ({ ...m.verifierPlan(...a), erreurs: [...verdict.erreurs], rendable: verdict.rendable }) };
});

const mots = Array.from({ length: 60 }, (_, k) => ({ w: `mot${"abcdefghij"[k % 10]}`, a: k / 2, f: k / 2 + 0.3 }));
const ENTREE = { mots, dureeSec: 30, prise: { src: "prise-montee.mp4", finSec: 30 }, fin: { debut: 30, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } } as unknown as EntreeRealisateur;
const reponse = { ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: [] } };

async function jouer(erreurs: string[], rendable = true) {
  verdict.erreurs = erreurs;
  verdict.rendable = rendable;
  const requetes: RequeteRealisateur[] = [];
  const r = await realiser(ENTREE, { appeler: async (q) => { requetes.push(q); return reponse; } });
  return { r, appels: requetes.length };
}

describe("plan gardé · D14 / D2a seuls", () => {
  it("D2a seule → plan gardé au 2ᵉ essai, version complète, phrase pour Will", async () => {
    const { r, appels } = await jouer(["D2a — seulement 2 emplacements différents sur les 5 plaquettes de 1,00 s à 9,00 s ; 3 au moins."]);
    expect(appels).toBe(2);
    expect(r.version).toBe("complete");
    expect(r.rendable).toBe(true);
    expect(r.phrase).toBe("Mise en scène gardée : 1 plaquette dépasse son plafond de variété (D14/D2a).");
    expect(r.avertissements.some((a) => a.startsWith("Plan gardé malgré : D2a — "))).toBe(true);
  });
  it("D14 + V6b → version simple après les 3 essais, jamais de plan gardé", async () => {
    const { r, appels } = await jouer(["D14 — « EtiquetteTete » apparaît 3 fois ; 2 au plus par vidéo de 30,00 s.", "V6b — deux plaquettes de suite au même emplacement."]);
    expect(appels).toBe(3);
    expect(r.version).toBe("simple");
    expect(r.phrase).toBe(PHRASE_REALISATEUR_REFUSE);
  });
  it("D14 + D15a → version simple, jamais de plan gardé", async () => {
    const { r } = await jouer(["D14 — « MotSaute » apparaît 3 fois ; 2 au plus par vidéo de 30,00 s.", "D15a — un texte affiché n'est pas dit."]);
    expect(r.version).toBe("simple");
  });
  it("D14 seule mais plan non rendable → version simple", async () => {
    const { r } = await jouer(["D14 — « MotSaute » apparaît 3 fois ; 2 au plus par vidéo de 30,00 s."], false);
    expect(r.version).toBe("simple");
  });
});

describe("consigne du rôle : stable d'un appel à l'autre (cache 1 h)", () => {
  it("`roleRealisateurV4().consigne` est identique entre deux appels", () => {
    expect(roleRealisateurV4().consigne).toBe(roleRealisateurV4().consigne);
    expect(roleRealisateurV4().consigne).not.toContain("Jamais prises");
  });
});
