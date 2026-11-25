/**
 * FIX-VOIX-TUTO-v21q : la voix du tutoriel réserve le texte RÉELLEMENT lu (script validé ou écrit, prononciations
 * appliquées), pour CHAQUE lecture permise (relances de ressemblance comprises), comme le devis (`index.ts:334-341`).
 * Par le vrai branchement (`tutoriel-branchements.ts`) puis le vrai `outilsVoixMaitre` (`chaine.ts`).
 * Doubles seulement : `credits` note chaque réservation, aucune voix lue, aucun appel HeyGen, 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lecturesVoixMax, type ReglageRessemblanceVoix } from "@/briques/voix-maitre/reference";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
import { servicesTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { outilsVoixMaitre, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { etablirDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { commandeTutoriel } from "./doubles";

const TARIF = 0.0375;

const etat = vi.hoisted(() => ({
  ressemblance: undefined as ReglageRessemblanceVoix | undefined,
  idVoix: "",
  reservations: [] as { origine: unknown; quantite: number; total: number; plafond: number; opts: Record<string, unknown> }[],
}));

vi.mock("@/services/tableau-outils", () => ({
  TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0.0375,
  branchementsReels: async () => ({
    voix: { idVoix: etat.idVoix, fournisseurVoix: "heygen", ...(etat.ressemblance ? { ressemblance: etat.ressemblance } : {}), renduEstSimule: () => false },
    montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) },
    env: "test",
  }),
  branchementsReelsSansVoix: async () => ({ montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
}));

vi.mock("@/services/credits", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  verifierEtReserverSelonOrigine: async (
    origine: unknown,
    estimation: { lignes: { quantite: number }[]; total: { centimes: number } },
    plafond: number,
    _libelle: string,
    opts: Record<string, unknown>,
  ) => {
    etat.reservations.push({ origine, quantite: estimation.lignes[0].quantite, total: estimation.total.centimes, plafond, opts });
  },
}));

beforeAll(async () => {
  await import("@/services/tutoriel-branchements");
});

beforeEach(() => {
  etat.ressemblance = undefined;
  etat.idVoix = VOIX_MAITRE_HEYGEN_ID;
  etat.reservations = [];
});

/** Texte lu de 858 caractères, absent de la commande (script validé / écrit depuis une idée). */
const TEXTE_858 = ("Ouvrez le tableau puis cliquez sur le bouton vert. ".repeat(17) + "Voilà, c'est fait.").slice(0, 858);

const motsDe = (n: number) => Array.from({ length: n }, (_, i) => `mot${i % 10}`).join(" ");

async function outilsDe(plus: Parameters<typeof commandeTutoriel>[0] = {}) {
  const commande = commandeTutoriel({ script: { blocs: [], texteComplet: "" }, ...plus });
  const o = (await servicesTutoriel().outils!(commande, "t1")) as OutilsTutoriel | null;
  expect(o?.voix).toBeDefined();
  return { commande, o: o! };
}

/** Une lecture = un appel d'`avantLecture` du vrai wrapper de la chaîne (ce que fait `machine.ts:187`). */
async function lire(plus: Parameters<typeof commandeTutoriel>[0] = {}, texte = TEXTE_858, lectures = 1) {
  const { commande, o } = await outilsDe(plus);
  const m = outilsVoixMaitre(o.voix!, commande, texte);
  for (let i = 0; i < lectures; i++) await m.avantLecture!();
  return { commande, m };
}

describe("FIX-VOIX-TUTO-v21q : réservation de la voix du tutoriel", () => {
  it("(a) commande au texte VIDE, texte lu de 858 caractères → la réservation compte 858 caractères (pas 0)", async () => {
    expect(TEXTE_858).toHaveLength(858);
    await lire({}, TEXTE_858, 1);
    expect(etat.reservations).toHaveLength(1);
    expect(etat.reservations[0].quantite).toBe(858);
    expect(etat.reservations[0].total).toBe(Math.ceil(858 * TARIF));
  });

  it("(b) Studio, ressemblance par défaut (2 lectures) : ⌈858 × 2 × tarif⌉ dès la 1re lecture, la 2e redemande le même total", async () => {
    etat.ressemblance = { actif: true, relancesMax: 1 };
    await lire({}, TEXTE_858, 2);
    const attendu = Math.ceil(858 * 2 * TARIF);
    expect(etat.reservations.map((r) => r.total)).toEqual([attendu, attendu]);
    expect(etat.reservations.map((r) => r.quantite)).toEqual([858 * 2, 858 * 2]);
    expect(etat.reservations.every((r) => r.plafond === attendu)).toBe(true);
    // Studio : même travail, aucune clé d'usine (la réservation unique du travail est remplacée, jamais cumulée).
    expect(etat.reservations.every((r) => r.opts.travailId === "t1" && !("cleUsine" in r.opts))).toBe(true);
  });

  it("(b) Studio, ressemblance coupée → × 1 ; 2 relances → × 3", async () => {
    etat.ressemblance = { actif: false, relancesMax: 2 };
    await lire();
    etat.ressemblance = { actif: true, relancesMax: 2 };
    await lire();
    expect(etat.reservations.map((r) => r.total)).toEqual([Math.ceil(858 * TARIF), Math.ceil(858 * 3 * TARIF)]);
  });

  it("(c) Usine : chaque lecture réserve ⌈858 × tarif⌉ sous une clé neuve (cumul = lectures faites, jamais plus que lecturesVoixMax)", async () => {
    etat.ressemblance = { actif: true, relancesMax: 2 };
    await lire({ origine: "usine" } as never, TEXTE_858, 3);
    expect(etat.reservations).toHaveLength(3);
    expect(etat.reservations.every((r) => r.total === Math.ceil(858 * TARIF) && r.quantite === 858 && r.origine === "usine")).toBe(true);
    const cles = etat.reservations.map((r) => r.opts.cleUsine);
    expect(cles.every((k) => typeof k === "string" && (k as string).startsWith("t1#"))).toBe(true);
    expect(new Set(cles).size).toBe(3);
    const cumul = etat.reservations.reduce((s, r) => s + r.total, 0);
    expect(cumul).toBeLessThanOrEqual(lecturesVoixMax(etat.ressemblance) * Math.ceil(858 * TARIF));
  });

  it("(d) prononciations appliquées : les caractères sont ceux du texte envoyé à la voix (texteLu)", async () => {
    const texte = "Zernio publie sur Zernio.";
    const { m } = await lire({ prononciations: [{ mot: "Zernio", prononciation: "zèrnio zèrnio" }] } as never, texte, 1);
    const lu = await m.texte();
    expect(lu).toBe("zèrnio zèrnio publie sur zèrnio zèrnio.");
    expect(etat.reservations[0].quantite).toBe(lu.length);
    expect(etat.reservations[0].quantite).not.toBe(texte.length);
  });

  it("(e) mode sans voix : 0 appel de réservation", async () => {
    const commande = commandeTutoriel({ entrees: { tutorielOutil: { scriptColle: true, modeVoix: "sans-voix" } } } as never);
    const o = await servicesTutoriel().outils!(commande, "t1");
    expect(o).not.toBeNull();
    expect(o!.voix).toBeUndefined();
    expect(etat.reservations).toHaveLength(0);
  });

  it("(f) voix non épinglée : refus AVANT toute réservation (inchangé)", async () => {
    etat.idVoix = "une-autre-voix";
    await expect(lire()).rejects.toThrow();
    expect(etat.reservations).toHaveLength(0);
  });

  it("(g) garde de texte : 1 seul verifierEtReserverSelonOrigine(c.origine, plus de c.script.texteComplet compté", () => {
    const src = readFileSync(join(process.cwd(), "src/services/tutoriel-branchements.ts"), "utf8");
    expect(src.split("verifierEtReserverSelonOrigine(c.origine").length - 1).toBe(1);
    expect(src).not.toContain('c.script.texteComplet ?? "").length');
    expect(src).toMatch(/\.\.\.cleDepenseUsine\(c\.origine, travailId\)/);
  });

  it("(h) Studio : le total réservé couvre la part voix du devis (104, 143 et 195 mots)", async () => {
    etat.ressemblance = { actif: true, relancesMax: 1 };
    for (const n of [104, 143, 195]) {
      etat.reservations = [];
      const texte = motsDe(n);
      const { m } = await lire({}, texte, 1);
      const lu = await m.texte();
      const lectures = lecturesVoixMax(etat.ressemblance);
      const devis = etablirDevis({ roles: [], caracteresScript: lu.length * lectures, texteScript: texte, motsScript: n * lectures, voixDejaPayee: false, ratios: ["4:5"], essai: false });
      const caracteresDevis = devis.lignes.filter((l) => l.unite === "caractere").reduce((s, l) => s + l.quantite, 0);
      expect(caracteresDevis).toBe(lu.length * 2);
      expect(etat.reservations[0].quantite).toBeGreaterThanOrEqual(caracteresDevis);
      expect(etat.reservations[0].total).toBeGreaterThanOrEqual(Math.ceil(caracteresDevis * TARIF));
    }
  });
});
