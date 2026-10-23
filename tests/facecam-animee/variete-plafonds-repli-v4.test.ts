/**
 * FACE CAMÉRA ANIMÉE v4 — VARIÉTÉ : règle D14 (plafond par fiche, non bloquante), repli selon la prise, historique lu par le service.
 */
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { assemblerPlan, realiser, verifierPlan, type EntreeRealisateur, type MotTranscrit, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { graineDe } from "@/moteurs/montage-facecam-animee/realisateur/index";
import { planMinimalV4, ROTATION_PLAN_MINIMAL_V4 } from "@/moteurs/montage-facecam-animee/realisateur/plan-minimal-v4";
import { VERSION_CHAINE_V4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { controlerSuiteV4, estRendableV4, resoudreElementsV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";

/** Parole factice : 3 mots par seconde, tous différents, lettres seulement. */
function parole(duree: number): MotTranscrit[] {
  const L = "bcdfghjklmnpqrstvwxz";
  return Array.from({ length: Math.floor(duree * 3) }, (_, k) => ({ w: `${L[k % 20]}a${L[Math.floor(k / 20) % 20]}o${L[Math.floor(k / 400) % 20]}ir`, a: k / 3, f: k / 3 + 0.28 }));
}
const sans = (id: string, debut: number, fin: number): ElementV4Plan => ({ id, debut, fin, mots: ["BONJOUR"], illustre: "bonjour" });

function erreursDuPlan(els: ElementV4Plan[], duree: number) {
  const { elements } = resoudreElementsV4(els, duree);
  return controlerSuiteV4(elements, { duree, finDebut: duree }).erreurs;
}

describe("variété v4 · D14 non bloquante", () => {
  it("3 EtiquetteTete → D14, mais le plan reste rendable", () => {
    const e = erreursDuPlan([sans("EtiquetteTete", 0, 1.5), sans("CarteCalendrier", 1.5, 4), sans("EtiquetteTete", 4, 5.5), sans("CarteChecklist", 5.5, 8), sans("EtiquetteTete", 8, 9.5)], 10);
    expect(e.some((x) => x.startsWith("D14 — « EtiquetteTete »"))).toBe(true);
    // D14 seule ne rend jamais un plan irrendable (elle fait recommencer le réalisateur, rien de plus).
    expect(estRendableV4(e.filter((x) => x.startsWith("D14")))).toBe(true);
    expect(estRendableV4(["D14 — « EtiquetteTete » apparaît 3 fois ; 2 au plus par vidéo."])).toBe(true);
  });
  it("2 EtiquetteTete → pas de D14 ; 3 PileNotifications → pas de D14", () => {
    const deux = erreursDuPlan([sans("EtiquetteTete", 0, 1.5), sans("CarteCalendrier", 1.5, 4), sans("EtiquetteTete", 4, 5.5)], 6);
    expect(deux.some((x) => x.startsWith("D14"))).toBe(false);
    const piles: ElementV4Plan[] = [];
    let t = 0;
    for (let k = 0; k < 3; k++) {
      piles.push({ id: "PileNotifications", debut: t, fin: t + 2, lignes: [{ texte: "BONJOUR", a: t }], illustre: "bonjour" });
      t += 2;
      piles.push(sans(["CarteCalendrier", "CarteChecklist", "GraphiqueBarres"][k], t, t + 2));
      t += 2;
    }
    expect(erreursDuPlan(piles, 90).some((x) => x.startsWith("D14"))).toBe(false); // plafond 3 pour une vidéo de 90 s
  });
});

describe("variété v4 · repli selon la prise", () => {
  const entree = (duree: number, mots: MotTranscrit[]): EntreeRealisateur => ({
    mots, dureeSec: duree, prise: { src: "a.mp4", finSec: duree }, fin: { debut: duree, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
  } as unknown as EntreeRealisateur);
  const plan = (duree: number, mots: MotTranscrit[], el: ElementV4Plan[]) => assemblerPlan(entree(duree, mots), { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: el }) as PlanFacecamAnimee;

  for (const duree of [90, 130]) {
    it(`${duree} s : rendable, aucune erreur bloquante`, () => {
      const mots = parole(duree);
      const el = planMinimalV4({ mots, horizon: duree, graine: 3 });
      expect(el.length).toBeGreaterThan(10);
      const v = verifierPlan(plan(duree, mots, el), mots);
      expect(v.rendable).toBe(true);
      expect(estRendableV4(v.erreurs)).toBe(true);
    });
  }
  it("deux graines : première plaquette de tête différente, deux plans rendables", () => {
    const mots = parole(60);
    const a = planMinimalV4({ mots, horizon: 60, graine: 0 });
    const b = planMinimalV4({ mots, horizon: 60, graine: 1 });
    const tete = (l: ElementV4Plan[]) => l.find((e) => ROTATION_PLAN_MINIMAL_V4.tete.includes(e.id))!.id;
    expect(tete(a)).not.toBe(tete(b));
    for (const el of [a, b]) expect(verifierPlan(plan(60, mots, el), mots).rendable).toBe(true);
  });
  it("sans graine : le comportement d'avant (ordre de la table)", () => {
    const mots = parole(60);
    expect(planMinimalV4({ mots, horizon: 60 })).toEqual(planMinimalV4({ mots, horizon: 60, graine: 0 }));
  });
});

describe("variété v4 · l'historique arrive à Claude dans le MESSAGE", () => {
  const entree = (historique?: EntreeRealisateur["historique"]): EntreeRealisateur => ({
    mots: parole(30), dureeSec: 30, prise: { src: "prise-montee.mp4", finSec: 30 }, fin: { debut: 30, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
    ...(historique ? { historique } : {}),
  } as unknown as EntreeRealisateur);
  const appelPanne = () => {
    const requetes: RequeteRealisateur[] = [];
    return { requetes, appeler: async (q: RequeteRealisateur) => { requetes.push(q); return { ok: false as const, message: "panne" }; } };
  };
  it("historique v4 non vide : le texte passé à Claude contient « Jamais prises », le système reste le même", async () => {
    const a = appelPanne();
    await realiser(entree([{ types: [], entrees: [], plaquettesV4: ["EtiquetteTete", "EtiquetteTete"], ouvertureV4: "EtiquetteTete" }]), { appeler: a.appeler });
    expect(a.requetes[0].message).toContain("Jamais prises");
    expect(a.requetes[0].message).toContain("EtiquetteTete (2)");
    expect(a.requetes[0].message).toContain("N'ouvrez pas par EtiquetteTete");
    const b = appelPanne();
    await realiser(entree([{ types: [], entrees: [], plaquettesV4: ["MotSaute"] }]), { appeler: b.appeler });
    expect(b.requetes[0].systeme).toBe(a.requetes[0].systeme);
  });
  it("historique vide : aucun bloc « Jamais prises » dans le message", async () => {
    const a = appelPanne();
    await realiser(entree([]), { appeler: a.appeler });
    expect(a.requetes[0].message).not.toContain("Jamais prises");
    const b = appelPanne();
    await realiser(entree(), { appeler: b.appeler });
    expect(b.requetes[0].message).not.toContain("Jamais prises");
  });
});

describe("variété v4 · graine du repli", () => {
  it("même prise → même graine ; prise différente → autre graine ; toujours entre 0 et 999", () => {
    const m = parole(10);
    expect(graineDe("prise-montee.mp4", m)).toBe(graineDe("prise-montee.mp4", [...m]));
    expect(graineDe("prise-montee.mp4", m)).not.toBe(graineDe("prise-montee.mp4", parole(20).reverse()));
    expect(graineDe("a.mp4", m)).not.toBe(graineDe("b.mp4", m));
    expect(graineDe("a.mp4", m)).toBeGreaterThanOrEqual(0);
    expect(graineDe("a.mp4", m)).toBeLessThan(1000);
  });
});

describe("variété v4 · le service lit les 5 dernières vidéos v4", () => {
  const travail = (id: string, cible: string, creeLe: string, plaquette: string | null) => ({
    id, cibleId: cible, fournisseurUtilise: "montage-facecam-animee", creeLe,
    parametres: plaquette ? { facecamAnimeeV4: { version: VERSION_CHAINE_V4, etape: "prete", realisation: { version: "complete", essais: 1, avertissements: 0, plan: { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: [sans(plaquette, 0, 2)] } } } } : {},
  });
  async function historiqueAvec(lister: (f: (t: never) => boolean) => Promise<unknown[]>) {
    vi.resetModules();
    vi.doMock("@/services/_commun", async (orig) => ({ ...(await orig<object>()), depots: () => ({ travaux: { lister } }) }));
    const { outilsFacecamAnimee } = await import("@/services/facecam-animee");
    const outils = await outilsFacecamAnimee({ videoId: "v-courante", travailId: "t-1", production: false, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);
    try {
      return await outils.historique!();
    } finally {
      vi.doUnmock("@/services/_commun");
    }
  }
  it("au plus 5 entrées, la plus récente d'abord, seulement les travaux avec un plan v4, hors la vidéo en cours, un seul travail par vidéo", { timeout: 60_000 }, async () => {
    const travaux = [
      ...Array.from({ length: 8 }, (_, k) => travail(`t${k}`, `v${k}`, `2026-10-1${k}T10:00:00Z`, k === 7 ? "MotSaute" : "CarteCalendrier")),
      travail("sans", "vx", "2026-10-19T10:00:00Z", null),
      travail("courant", "v-courante", "2026-10-19T11:00:00Z", "BadgeCompteur"),
      travail("v7-ancien", "v7", "2026-10-01T10:00:00Z", "Chrono"),
      travail("v7-recent", "v7", "2026-10-18T10:00:00Z", "MotSaute"),
    ];
    const h = await historiqueAvec(async (f) => travaux.filter(f as never));
    expect(h).toHaveLength(5);
    expect(h[0].plaquettesV4).toEqual(["MotSaute"]);
    const toutes = h.flatMap((x) => x.plaquettesV4 ?? []);
    expect(toutes).not.toContain("BadgeCompteur"); // la vidéo en cours est exclue
    expect(toutes).not.toContain("Chrono"); // le travail le plus récent de v7 seul
  });
  it("une lecture qui échoue ne bloque pas : historique vide", { timeout: 60_000 }, async () => {
    const h = await historiqueAvec(async () => { throw new Error("base illisible"); });
    expect(h).toEqual([]);
  });
});
