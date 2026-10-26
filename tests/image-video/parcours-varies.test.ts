/**
 * Parcours variés par type d'image : validité (règles de forme existantes), répartition, déterminisme,
 * anti-répétition, scènes à éviter dans la consigne. Aucun réseau.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage, TypeImage } from "@/domaine/image-video/carte";
import { TYPES_IMAGE } from "@/domaine/image-video/carte";
import { complexiteDe } from "@/domaine/image-video/complexite";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { variableEcritureIV } from "@/moteurs/montage-image-video/ecriture";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import {
  CODE_PARCOURS_REFERENCE,
  PARCOURS_VARIES,
  candidatsParcours,
  choisirParcoursIV,
  consigneAEviter,
  scenesAEviter,
  squeletteDe,
  squelettesRecentsIV,
  tirerParcoursIV,
  type SqueletteRecent,
} from "@/moteurs/montage-image-video/parcours-varies";
import { RECETTES, scenesPermises } from "@/moteurs/montage-image-video/recettes";
import { SEUIL_RESSEMBLANCE_SCENES, manquementRessemblanceScenes, ressemblanceScenes } from "@/moteurs/montage-image-video/ressemblance-scenes";
import { INTERDITS_PERMANENTS, aCorrigerParClaude, cleFormule, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";

const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);
/** Carte de base de chaque type (les types sans fixture empruntent une carte et changent de type). */
const BASE: Record<TypeImage, string> = { benefices: "A", chaine: "A", embranchement: "C", entonnoir: "D", "avant-apres": "F", convergence: "E", "tableau-de-bord": "A", chronologie: "A" };
const carteDe = (type: TypeImage): CarteImage => ({ ...lire(BASE[type]), types: [type] }) as CarteImage;

/** Fiche factice d'un parcours : la fiche simulée de la carte, scènes de l'explication prises dans celles du parcours. */
function ficheDuParcours(carte: CarteImage, scenes: readonly Scene[]): FicheImage {
  const f = ficheSimulee(lire(BASE[carte.types[0]]).image.empreinte)!;
  const permises = scenesPermises(carte.types);
  let i = 0;
  for (const e of f.ecrans) if (e.partie === "explication") e.scene = scenes.filter((s) => permises.has(s))[i++ % scenes.length]!;
  return f;
}

describe("parcours variés : validité", () => {
  for (const type of TYPES_IMAGE) {
    it(`${type} : au moins trois parcours alternatifs, tous valides`, () => {
      expect(PARCOURS_VARIES[type].length).toBeGreaterThanOrEqual(3);
      const permises = scenesPermises([type]);
      const codes = new Set<string>();
      for (const p of PARCOURS_VARIES[type]) {
        expect(codes.has(p.code)).toBe(false);
        codes.add(p.code);
        expect(p.scenes.length).toBeGreaterThan(0);
        for (const s of p.scenes) expect(permises.has(s)).toBe(true);
        // Ossature : l'accroche ouvre, la phrase-choc ferme ; l'annonce du nombre reste demandée aux types qui l'annoncent.
        expect(p.parcours.startsWith("accroche")).toBe(true);
        expect(p.parcours.trim().endsWith("phrase-choc")).toBe(true);
        if (RECETTES[type].annonceNombre) expect(p.parcours).toContain("<annonce>");
        // Aucun nombre écrit, aucun mot interdit.
        expect(p.parcours).not.toMatch(/\d/);
        for (const mot of [...INTERDITS_PERMANENTS, "machine", "Grenoble", "certifié", "Aucun gain garanti"]) expect(p.parcours.toLowerCase()).not.toContain(mot.toLowerCase());
      }
    });

    it(`${type} : une fiche factice par parcours passe les règles de forme`, () => {
      const carte = carteDe(type);
      const base = aCorrigerParClaude(verifierScript(ficheDuParcours(carte, ["titre"]), { carte, choixFormules: GARDER })).map((m) => m.message);
      for (const p of PARCOURS_VARIES[type]) {
        const fiche = ficheDuParcours(carte, p.scenes);
        const refus = aCorrigerParClaude(verifierScript(fiche, { carte, choixFormules: GARDER })).map((m) => m.message);
        expect(refus, p.code).toEqual(base);
        expect(fiche.ecrans.some((e) => p.scenes.includes(e.scene))).toBe(true);
      }
    });
  }
});

describe("parcours variés : tirage", () => {
  const ids = Array.from({ length: 300 }, (_, i) => createHash("sha256").update(`video-${i}`).digest("hex").slice(0, 12));

  it("déterministe : même graine, même historique, même parcours", () => {
    for (const id of ids.slice(0, 20)) {
      const h = [{ parcours: "chaine-fil", scenes: ["titre"] as Scene[] }];
      expect(tirerParcoursIV({ graine: id, type: "chaine", historique: h })).toBe(tirerParcoursIV({ graine: id, type: "chaine", historique: h }));
      expect(choisirParcoursIV({ graine: id, carte: carteDe("chaine"), historique: h })).toEqual(choisirParcoursIV({ graine: id, carte: carteDe("chaine"), historique: h }));
    }
  });

  for (const type of TYPES_IMAGE) {
    it(`${type} : sur 300 ids, aucun parcours au-dessus de quarante pour cent (sans et avec historique)`, () => {
      const sans = new Map<string, number>();
      for (const id of ids) sans.set(tirerParcoursIV({ graine: id, type }), (sans.get(tirerParcoursIV({ graine: id, type })) ?? 0) + 1);
      const avec = new Map<string, number>();
      const histo: SqueletteRecent[] = [];
      for (const id of ids) {
        const code = tirerParcoursIV({ graine: id, type, historique: histo });
        avec.set(code, (avec.get(code) ?? 0) + 1);
        histo.unshift({ parcours: code, scenes: [] });
      }
      for (const m of [sans, avec]) {
        expect(m.size).toBe(candidatsParcours(type).length);
        for (const n of m.values()) expect(n / 300).toBeLessThanOrEqual(0.4);
      }
    });

    it(`${type} : jamais le même parcours que l'une des trois dernières vidéos`, () => {
      const histo: SqueletteRecent[] = [];
      for (const id of ids) {
        const code = tirerParcoursIV({ graine: id, type, historique: histo });
        for (const h of histo.slice(0, 3)) expect(code).not.toBe(h.parcours);
        histo.unshift({ parcours: code, scenes: [] });
      }
    });
  }

  it("historique sans parcours noté : compté comme la référence", () => {
    const h = [{ scenes: ["titre"] as Scene[] }];
    for (const id of ids.slice(0, 50)) expect(tirerParcoursIV({ graine: id, type: "chaine", historique: h })).not.toBe(CODE_PARCOURS_REFERENCE);
  });
});

describe("scènes à éviter", () => {
  const sq = (...scenes: Scene[]): SqueletteRecent => ({ scenes });
  const type: TypeImage[] = ["entonnoir"];

  it("rien sans historique", () => expect(scenesAEviter({ types: type, historique: [] })).toEqual([]));

  it("reprend les scènes communes des squelettes récents, jamais la phrase-choc ni celles du type", () => {
    const s = sq("accroche", "micro-objet", "titre", "entonnoir", "nuee", "ensemble", "phrase-choc");
    const evite = scenesAEviter({ types: type, historique: [s, s, s] });
    expect(evite).toEqual(expect.arrayContaining(["accroche", "micro-objet", "titre", "ensemble"]));
    expect(evite).not.toContain("phrase-choc");
    expect(evite).not.toContain("entonnoir");
    expect(evite).not.toContain("nuee");
  });

  it("une scène dans un seul des trois squelettes n'est pas évitée", () => {
    expect(scenesAEviter({ types: type, historique: [sq("titre", "email"), sq("titre", "alerte"), sq("titre", "dossiers")] })).toEqual(["titre"]);
  });

  it("laisse toujours des scènes libres", () => {
    const toutes = [...scenesPermises(type)];
    expect(scenesPermises(type).size - scenesAEviter({ types: type, historique: [sq(...toutes)] }).length).toBeGreaterThanOrEqual(7);
  });

  it("la consigne est dans la partie variable, sans nombre ni mot interdit ; absente sans historique", () => {
    const carte = lire("D");
    const complexite = complexiteDe(carte);
    const aEviter: Scene[] = ["titre", "ensemble"];
    const v = variableEcritureIV(carte, complexite, GARDER, undefined, { code: "entonnoir-pluie", aEviter });
    expect(v).toContain("<a_eviter>");
    expect(v).toContain(consigneAEviter(aEviter));
    expect(consigneAEviter(aEviter)).not.toMatch(/\d/);
    expect(v).toContain(PARCOURS_VARIES.entonnoir.find((p) => p.code === "entonnoir-pluie")!.parcours);
    expect(v).not.toContain(RECETTES.entonnoir.parcours);
    expect(variableEcritureIV(carte, complexite, GARDER, undefined, { code: CODE_PARCOURS_REFERENCE, aEviter: [] })).toBe(variableEcritureIV(carte, complexite, GARDER));
  });
});

describe("historique des squelettes et ressemblance", () => {
  it("squelettesRecentsIV : prêtes seulement, sans la vidéo en cours, trois au plus", () => {
    const fiche = { ecrans: [{ scene: "titre" }, { scene: "ensemble" }] } as unknown as FicheImage;
    const etat = (videoId: string, etape = "prete", code?: string) => ({ etape, demande: { videoId }, ...(code ? { parcours: { code } } : {}), script: { fiche } });
    const r = squelettesRecentsIV([etat("a", "prete", "x"), etat("b", "voix"), etat("c"), etat("d"), etat("e"), etat("f")], "d");
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ parcours: "x", scenes: squeletteDe(fiche) });
    expect(r[1]!.parcours).toBeUndefined();
  });

  it("ressemblanceScenes : identique = 1, disjoint = 0 ; le refus s'applique au seuil", () => {
    const a: Scene[] = ["accroche", "titre", "ensemble", "phrase-choc"];
    expect(ressemblanceScenes(a, a)).toBe(1);
    expect(ressemblanceScenes(a, ["email", "alerte"])).toBe(0);
    expect(manquementRessemblanceScenes(a, [a])).toContain("ressemble trop");
    expect(manquementRessemblanceScenes(a, [["email", "alerte", "dossiers"]])).toBeNull();
    expect(SEUIL_RESSEMBLANCE_SCENES).toBeGreaterThan(0.5);
  });
});
