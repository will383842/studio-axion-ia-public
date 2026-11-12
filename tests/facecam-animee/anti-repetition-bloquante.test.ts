/**
 * FACE CAMÉRA ANIMÉE v4 — GV-MD-01 : la mémoire des animations déjà servies est une RÈGLE (D17a ouverture, D17b plaquettes reprises),
 * plus seulement un conseil. Bloquante aux essais 1 à N-1 du réalisateur, simple avertissement au dernier : jamais d'échec de vidéo pour cette raison.
 * AUCUN appel réseau.
 */
import { describe, expect, it } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { assemblerPlan, ESSAIS_MAX_REALISATEUR, realiser, verifierPlan, type EntreeRealisateur, type HistoriqueVideo, type MotTranscrit, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { blocHistoriqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { planMinimalV4 } from "@/moteurs/montage-facecam-animee/realisateur/plan-minimal-v4";
import { SEUILS_V4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

/** Parole factice : 3 mots par seconde, tous différents (même données que `variete-plafonds-repli-v4.test.ts`). */
function parole(duree: number): MotTranscrit[] {
  const L = "bcdfghjklmnpqrstvwxz";
  return Array.from({ length: Math.floor(duree * 3) }, (_, k) => ({ w: `${L[k % 20]}a${L[Math.floor(k / 20) % 20]}o${L[Math.floor(k / 400) % 20]}ir`, a: k / 3, f: k / 3 + 0.28 }));
}

const DUREE = 60;
const mots = parole(DUREE);
const entree = (historique?: HistoriqueVideo[]): EntreeRealisateur =>
  ({
    mots, dureeSec: DUREE, prise: { src: "a.mp4", finSec: DUREE }, fin: { debut: DUREE, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
    ...(historique ? { historique } : {}),
  }) as unknown as EntreeRealisateur;
const elements: ElementV4Plan[] = planMinimalV4({ mots, horizon: DUREE, graine: 0 });
const plan = (el: ElementV4Plan[] = elements) => assemblerPlan(entree(), { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: el }) as PlanFacecamAnimee;

const ouverture = [...elements].sort((a, b) => a.debut - b.debut)[0].id;
const distinctes = [...new Set(elements.map((e) => e.id))];
const video = (extra: Partial<HistoriqueVideo>): HistoriqueVideo => ({ types: [], entrees: [], ...extra });
const d17 = (l: readonly string[]) => l.filter((x) => x.startsWith("D17"));

describe("anti-répétition · D17a (ouverture)", () => {
  it("le plan de l'exemple a assez de plaquettes différentes pour juger D17b", () => {
    expect(distinctes.length).toBeGreaterThanOrEqual(SEUILS_V4.plaquettesMinPourReprise);
  });
  it("ouvre comme la vidéo précédente → erreur D17a, mais le plan reste rendable", () => {
    const sans = verifierPlan(plan(), mots);
    const v = verifierPlan(plan(), mots, { historique: [video({ ouvertureV4: ouverture })] });
    expect(d17(v.erreurs).some((e) => e.startsWith("D17a"))).toBe(true);
    expect(v.rendable).toBe(sans.rendable);
  });
  it("ouvre comme la 3ᵉ dernière vidéo → erreur ; comme la 4ᵉ → rien", () => {
    const autre = video({ ouvertureV4: "AutrePlaquette" });
    expect(d17(verifierPlan(plan(), mots, { historique: [autre, autre, video({ ouvertureV4: ouverture })] }).erreurs)).toHaveLength(1);
    expect(d17(verifierPlan(plan(), mots, { historique: [autre, autre, autre, video({ ouvertureV4: ouverture })] }).erreurs)).toHaveLength(0);
  });
});

describe("anti-répétition · D17b (plaquettes reprises)", () => {
  const n = distinctes.length;
  const k = Math.floor(SEUILS_V4.partReprisePlaquettesMax * n) + 1; // juste au-dessus du seuil
  it("plus de 60 % des plaquettes déjà prises dans les 2 dernières vidéos → erreur D17b", () => {
    const v = verifierPlan(plan(), mots, { historique: [video({ plaquettesV4: distinctes.slice(0, k) })] });
    expect(d17(v.erreurs).some((e) => e.startsWith("D17b"))).toBe(true);
  });
  it("juste au seuil (une plaquette de moins) → rien", () => {
    const v = verifierPlan(plan(), mots, { historique: [video({ plaquettesV4: distinctes.slice(0, k - 1) })] });
    expect(d17(v.erreurs)).toHaveLength(0);
  });
  it("la 3ᵉ vidéo n'est plus regardée (2 dernières seulement)", () => {
    const vide = video({ plaquettesV4: ["AutrePlaquette"] });
    const v = verifierPlan(plan(), mots, { historique: [vide, vide, video({ plaquettesV4: distinctes })] });
    expect(d17(v.erreurs)).toHaveLength(0);
  });
});

describe("anti-répétition · sans historique, rien ne change", () => {
  it("pas d'historique, historique vide, historique sans plaquettes v4 : mêmes erreurs et avertissements", () => {
    const base = verifierPlan(plan(), mots);
    expect(d17(base.erreurs)).toHaveLength(0);
    for (const historique of [[], [video({})], [video({ titre: "x" }), video({})]]) {
      const v = verifierPlan(plan(), mots, { historique });
      expect(v.erreurs).toEqual(base.erreurs);
      expect(v.avertissements).toEqual(base.avertissements);
    }
  });
});

describe("anti-répétition · jamais d'échec pour cette raison", () => {
  it("avec l'option du dernier essai : D17 devient un avertissement, plus une erreur", () => {
    const historique = [video({ ouvertureV4: ouverture, plaquettesV4: distinctes })];
    const bloquant = verifierPlan(plan(), mots, { historique });
    const dernier = verifierPlan(plan(), mots, { historique, repetitionEnAvertissement: true });
    expect(d17(bloquant.erreurs).length).toBeGreaterThanOrEqual(2);
    expect(d17(dernier.erreurs)).toHaveLength(0);
    expect(d17(dernier.avertissements).length).toBe(d17(bloquant.erreurs).length);
    expect(dernier.erreurs).toEqual(bloquant.erreurs.filter((e) => !e.startsWith("D17")));
  });

  it("Opus répète toujours le même plan : erreur renvoyée aux essais 1 et 2, plan gardé et signalé au dernier, aucun appel de plus", async () => {
    const historique = [video({ ouvertureV4: ouverture, plaquettesV4: distinctes })];
    const requetes: RequeteRealisateur[] = [];
    const appeler = async (q: RequeteRealisateur) => {
      requetes.push(q);
      return { ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: elements } };
    };
    const r = await realiser(entree(historique), { appeler });
    // Jamais plus d'essais que le nombre prévu.
    expect(requetes.length).toBeLessThanOrEqual(ESSAIS_MAX_REALISATEUR);
    // L'erreur est renvoyée à l'essai suivant.
    expect(requetes.length).toBeGreaterThanOrEqual(2);
    expect(requetes[1].message).toContain("D17a");
    // Si le plan n'a aucun autre défaut (cas de cet exemple), il est gardé au dernier essai et la répétition est signalée.
    const autres = verifierPlan(plan(), mots).erreurs;
    if (!autres.length) {
      expect(requetes.length).toBe(ESSAIS_MAX_REALISATEUR);
      expect(r.version).toBe("complete");
      expect(r.rendable).toBe(true);
      expect(r.essais).toBe(ESSAIS_MAX_REALISATEUR);
      expect(d17(r.avertissements).length).toBeGreaterThanOrEqual(2);
      expect(r.phrase).toBeTruthy();
    }
  });

  it("sans historique : le plan passe au premier essai, sans phrase", async () => {
    const requetes: RequeteRealisateur[] = [];
    const appeler = async (q: RequeteRealisateur) => {
      requetes.push(q);
      return { ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: elements } };
    };
    const r = await realiser(entree(), { appeler });
    if (!verifierPlan(plan(), mots).erreurs.length) {
      expect(requetes.length).toBe(1);
      expect(r.phrase).toBeUndefined();
    }
  });
});

describe("anti-répétition · la consigne dit la règle", () => {
  it("le bloc d'historique annonce le refus, les ouvertures à éviter et le seuil", () => {
    const b = blocHistoriqueV4([video({ plaquettesV4: ["EtiquetteTete"], ouvertureV4: "EtiquetteTete" })]);
    expect(b).toContain("plan refusé et à refaire si");
    expect(b).toContain("EtiquetteTete");
    expect(b).toContain(`${Math.round(100 * SEUILS_V4.partReprisePlaquettesMax)} %`);
  });
  it("sans historique v4 : toujours aucun bloc", () => {
    expect(blocHistoriqueV4([])).toBe("");
    expect(blocHistoriqueV4([video({})])).toBe("");
  });
});
