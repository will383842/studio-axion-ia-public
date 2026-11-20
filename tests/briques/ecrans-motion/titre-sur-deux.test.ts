/** CC12 : un titre d'écran « étape » ou « objet » trop large pour une ligne passe sur 2 lignes (mêmes mots) au lieu d'être refusé. */
import { describe, expect, it } from "vitest";
import {
  boites,
  boitesEcran,
  charteDuoPour,
  controlerProprietes,
  disposer,
  proprietesEcrans,
  TYPES_ECRAN,
  zoneUtile,
  type EcranCale,
  type ProprietesEcran,
} from "../../../src/briques/ecrans-motion";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])!;
const BASE = { fond: "sombre", debutMs: 0, finMs: 2800, evenements: [{ cible: "ligne", ms: 400 }] };
const ecran = (c: Record<string, unknown>) => ({ ...BASE, ...c }) as EcranCale;
const proprietes = (cs: EcranCale[]): ProprietesEcran[] => proprietesEcrans({ ecrans: cs, captures: {}, zoneProtegee: QUATRE });
const VISUEL = { objet: "dossier-classe" };

/** Condensé du JSON (relevé sur master f709ff8a, avant le changement) : une ligne qui bouge change le condensé. */
const condense = (v: unknown) => {
  let h = 0;
  for (const c of JSON.stringify(v)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const LONG = "Automatisations comptables intelligentes";
const ETAPE_LONGUE = ecran({ id: "e1", type: "etape", numero: 2, nombreEtapes: 6, titre: LONG, ligne: "x", visuel: VISUEL, puces: ["a", "b"] });
const OBJET_LONG = ecran({ id: "e2", type: "objet", titre: LONG, ligne: "x", visuel: VISUEL });

describe("CC12 · titre trop large : 2 lignes, mêmes mots", () => {
  it.each([["etape", ETAPE_LONGUE], ["objet", OBJET_LONG]] as const)("%s : accepté, titre sur 2 lignes, mêmes mots", (_t, e) => {
    const [p] = proprietes([e]);
    expect(controlerProprietes(p)).toEqual([]);
    const titre = disposer(p).textes.find((x) => x.nom === "titre")!;
    expect(titre.lignesMax).toBe(2);
    expect(titre.tient).toBe(true);
    expect(titre.lignes.length).toBe(2);
    expect(titre.lignes.join(" ")).toBe(LONG.toUpperCase());
  });

  it("titre qui ne tient pas même sur 2 lignes : toujours refusé", () => {
    const [p] = proprietes([ecran({ id: "e3", type: "objet", titre: "Automatisations comptables internationalisées", ligne: "x", visuel: VISUEL })]);
    const [q] = proprietes([ecran({ id: "e4", type: "objet", titre: "Anticonstitutionnellement incompréhensiblement inconstitutionnalisations", ligne: "x", visuel: VISUEL })]);
    expect([...controlerProprietes(p), ...controlerProprietes(q)].some((l) => l.includes("ne tient pas"))).toBe(true);
  });
});

describe("CC12 · éteint = identique", () => {
  it("écrans étape et objet dont le titre tient : mêmes boîtes qu'avant (condensés relevés sur master)", () => {
    const ps = proprietes([
      ecran({ id: "e1", type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: VISUEL, puces: ["Inscrite", "Réservé sans nous"] }),
      ecran({ id: "e2", type: "objet", titre: "Dossier *classé.*", ligne: "Le rappel part tout seul.", visuel: VISUEL }),
      ecran({ id: "e3", type: "etape", numero: 1, nombreEtapes: 3, titre: "Automatisations comptables", ligne: "x", visuel: VISUEL, puces: [] }),
      ecran({ id: "e4", type: "objet", titre: "Rapprochements bancaires", ligne: "x", visuel: VISUEL }),
    ]);
    expect(ps.map((p) => condense(boitesEcran(p)))).toEqual([3951322717,1452114891,678050367,1452114891]);
    for (const p of ps) expect(boitesEcran(p).textes.find((x) => x.nom === "titre")!.lignesMax).toBe(1);
  });

  it("boites() sans titreSurDeux : identique à master pour les 12 types", () => {
    const zone = zoneUtile(QUATRE, 1080, 1920);
    expect(TYPES_ECRAN.map((t) => condense(boites(t, zone, charteDuoPour(1920), {})))).toEqual([1503250775,3423685524,1866645296,3565952728,241475333,307404481,4294479051,2859477720,552747044,4098916498,4185501886,3904069968]);
  });
});
