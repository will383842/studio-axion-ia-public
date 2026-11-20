/**
 * S-04a-v19b · deux réparations sans IA du cas concret, écrites à part : marque remise, calage approché.
 * Rien ne les appelle encore (garde statique en bas).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERSION_FICHE_ECRANS, type EcranCorps, type EcranFin, type FicheEcrans, type FinPlanifiee } from "@/moteurs/montage-cas-concret/fiche";
import { calerFiche, IMAGE_MS } from "@/moteurs/montage-cas-concret/calage";
import { ECRAN_DUREE_MIN_MS, regleMarque } from "@/moteurs/montage-cas-concret/regles";
import { calageApproche, remettreMarque } from "@/moteurs/montage-cas-concret/reparations-ecrans";
import type { MotCalage } from "@/briques/motion/calage";

const ecran = (n: number, texteDit: string, extra: Partial<EcranCorps> = {}) =>
  ({ id: `e${String(n).padStart(2, "0")}`, type: "titre", lignes: ["Titre"], fond: "sombre", marque: "axion-ia.com", texteDit, avanceMs: 0, evenements: [], ...extra }) as EcranCorps;
const fiche = (ecrans: EcranCorps[]): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a", ecrans,
});
const trois = () => fiche([ecran(1, "un deux trois"), ecran(2, "quatre cinq six"), ecran(3, "sept huit neuf")]);
const mot = (m: string, debutSec: number): MotCalage => ({ mot: m, debutSec, finSec: debutSec + 0.3 });
/** Voix rapide : le corps finit vers 0,9 s, avant que e01 ait son temps : le calage exact refuse (« l'écran ne dure pas »). */
const motsRapides = (): MotCalage[] =>
  [["un", 0.18], ["deux", 0.3], ["trois", 0.47], ["quatre", 0.54], ["cinq", 0.57], ["six", 0.75], ["sept", 0.91], ["huit", 1.05], ["neuf", 1.13]].map(([m, d]) => ({ mot: m as string, debutSec: d as number, finSec: (d as number) + 0.05 }));
const finPlanifiee = (): FinPlanifiee => ({
  id: "fin-facebook", reseaux: ["facebook"], appels: [],
  ecrans: [{ id: "f01", type: "promesse", fins: ["fin-if-cadeau-automatisation"], cadeau: "Toute la structure", fond: "sombre", marque: "axion-ia.com", texteDit: "sept huit neuf", avanceMs: 0, evenements: [] } as EcranFin],
});
const deux = (evenements: EcranCorps["evenements"] = []) => fiche([ecran(1, "un deux trois"), ecran(2, "quatre cinq six", { evenements })]);
const optionsFin = { finApresDernierMotSec: 2.15 };
const options = { finApresDernierMotSec: 2.1 };

describe("remettreMarque", () => {
  it("remet la marque sur l'écran qui l'a perdue, sans toucher la fiche reçue", () => {
    const f = trois();
    f.ecrans[1] = ecran(2, "quatre cinq six", { marque: "axion" });
    const avant = structuredClone(f);
    const r = remettreMarque(f);
    expect(regleMarque(f)).toHaveLength(1);
    expect(regleMarque(r.fiche)).toEqual([]);
    expect(r.faits).toEqual(["Écran e02 : marque remise."]);
    expect(f).toEqual(avant);
    expect(r.fiche.ecrans[1]).toEqual({ ...avant.ecrans[1], marque: "axion-ia.com" });
    expect(r.fiche.ecrans[0]).toEqual(avant.ecrans[0]);
  });
  it("une fiche déjà juste ressort identique, sans fait", () => {
    const f = trois();
    const r = remettreMarque(f);
    expect(r.fiche).toEqual(f);
    expect(r.faits).toEqual([]);
  });
});

describe("calageApproche", () => {
  it("répare le refus « l'écran ne dure pas » en répartissant les écrans sur la voix", () => {
    const f = deux();
    const exact = calerFiche(f, finPlanifiee(), motsRapides(), optionsFin);
    expect(exact.ok).toBe(false);
    if (!exact.ok) expect(exact.problemes.join(" ")).toContain("l'écran ne dure pas");
    const r = calageApproche(f, finPlanifiee(), motsRapides(), optionsFin);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    expect(r.reserve).toBe("Calage approché : écrans répartis sur la voix sans heures exactes. À vérifier.");
    expect(r.ecarts).toEqual([]);
    const e = [...r.fiche.ecrans, ...r.fin!.ecrans];
    expect(e.map((x) => x.id)).toEqual(["e01", "e02", "f01"]);
    expect(e.map((x) => x.texteDit)).toEqual(["un deux trois", "quatre cinq six", "sept huit neuf"]);
    expect(e[0].debutMs).toBe(0);
    e.forEach((x, k) => {
      expect(x.finMs! - x.debutMs!).toBeGreaterThanOrEqual(ECRAN_DUREE_MIN_MS);
      expect(x.debutMs! % IMAGE_MS).toBe(0);
      expect(x.finMs! % IMAGE_MS).toBe(0);
      if (k > 0) expect(x.debutMs).toBeGreaterThan(e[k - 1].debutMs!);
      if (k > 0) expect(x.debutMs).toBe(e[k - 1].finMs);
    });
    expect(e[2].finMs).toBe(r.dureeMs);
    expect(r.dureeMs).toBeGreaterThanOrEqual(3280);
    expect(r.dureeMs).toBeLessThanOrEqual(3320);
  });
  it("place un événement au prorata de son mot dans son écran", () => {
    const f = deux([{ cible: "titre-1", surMot: 1, avanceMs: 0 }]);
    const r = calageApproche(f, finPlanifiee(), motsRapides(), optionsFin);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    const e2 = r.fiche.ecrans[1];
    expect(r.evenements).toHaveLength(1);
    expect(r.evenements[0].ecranId).toBe("e02");
    expect(r.evenements[0].debutMs).toBeGreaterThan(e2.debutMs!);
    expect(r.evenements[0].debutMs).toBeLessThan(e2.finMs!);
    expect(r.evenements[0].debutMs % IMAGE_MS).toBe(0);
  });
  it("si le calage exact réussit, il est rendu tel quel (sans réserve)", () => {
    const mots = ["un", "deux", "trois", "quatre", "cinq", "six"].map((m, i) => mot(m, i * 0.9));
    const a = calerFiche(deux(), null, mots, options);
    expect(a.ok).toBe(true);
    expect(calageApproche(deux(), null, mots, options)).toEqual(a);
  });
  it("contre-épreuve : aucun mot dit → même refus que calerFiche", () => {
    const a = calerFiche(trois(), null, [], options);
    const b = calageApproche(trois(), null, [], options);
    expect(a.ok).toBe(false);
    expect(b).toEqual(a);
  });
  it("contre-épreuve : événement au-delà des mots → même refus que calerFiche", () => {
    const f = fiche([ecran(1, "un deux trois", { evenements: [{ cible: "titre-1", surMot: 7, avanceMs: 0 }] } as Partial<EcranCorps>), ecran(2, "quatre cinq six")]);
    const a = calerFiche(f, null, motsRapides(), options);
    expect(a.ok).toBe(false);
    expect(calageApproche(f, null, motsRapides(), options)).toEqual(a);
  });
  it("contre-épreuve : heures incohérentes → même refus que calerFiche", () => {
    const mauvais: MotCalage[] = [{ mot: "un", debutSec: 2, finSec: 1 }];
    const a = calerFiche(trois(), null, mauvais, options);
    expect(a.ok).toBe(false);
    expect(calageApproche(trois(), null, mauvais, options)).toEqual(a);
  });
  it("une voix trop courte pour 1 000 ms par écran est refusée, jamais inventée", () => {
    const court: MotCalage[] = [mot("un", 0)];
    const r = calageApproche(trois(), null, court, { finApresDernierMotSec: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("éteint = identique", () => {
  it("aucun fichier de src/** n'importe reparations-ecrans", () => {
    const touches: string[] = [];
    const marcher = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) marcher(p);
        else if (/\.(ts|tsx|mts)$/.test(n) && n !== "reparations-ecrans.ts" && readFileSync(p, "utf8").includes("reparations-ecrans")) touches.push(p);
      }
    };
    marcher(join(__dirname, "..", "..", "..", "src"));
    expect(touches).toEqual([]);
  });
});
