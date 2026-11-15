import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import {
  CLE_ENTREE_BIBLIOTHEQUE,
  lireEntreeBibliotheque,
  schemaEntreeBibliotheque,
} from "@/briques/bibliotheque-video/schema";

const profilMinimal = () => ({
  id: "p1", formatId: "f1", version: 1,
  capacites: { "texte.surlignage": { permis: true } },
  plafonds: {},
  memoire: { fenetreVideos: 10, portee: "format" as const },
  verrous: [],
});

const entreeMinimale = (): EntreeBibliotheque => ({
  version: "bibliotheque-video/1",
  profil: profilMinimal(),
  recents: [{ capacite: "texte.surlignage", cle: "a", videoId: "v1" }],
  graine: "g", figeeLe: "2026-11-15T10:00:00Z",
});

const entreeComplete = (): EntreeBibliotheque => ({
  ...entreeMinimale(),
  profil: {
    ...profilMinimal(),
    capacites: { "texte.surlignage": { permis: true, maxParVideo: 2, decision: "ok" } },
    plafonds: { evenementsParMinute: 4, transitionsMax: 3, extraitsMax: 2 },
    blocs: {
      texteEcran: { teintes: ["terracotta", "ivoire"], cibles: ["souligne", "mot-dit"], pave: true, outils: false, bandeauNom: true, intensites: ["douce"], signaturesAEviter: 3 },
      extraits: { visageSurInstagram: true, texteIncrusteAccepte: { "ecran.capture": false }, dureeMinSec: 3, uneSourceParVideo: true },
      habillage: { partCoupesFranchesMin: 0.5, pleinCadrePermis: false, fondsAnimes: false, lumieres: false },
      calques: { texteDerriereMax: 1 },
    },
  },
  choix: [
    { capacite: "texte.surlignage", cle: "k1", signature: "sig" },
    { capacite: "fond.doux", cle: "k2" },
  ],
});

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const avec = (e: unknown) => ({ [CLE_ENTREE_BIBLIOTHEQUE]: e });

describe("schéma strict et lireEntreeBibliotheque", () => {
  it("la clé est bibliothequeVideo", () => {
    expect(CLE_ENTREE_BIBLIOTHEQUE).toBe("bibliothequeVideo");
  });

  it("le schéma suit le type du contrat", () => {
    expectTypeOf<z.infer<typeof schemaEntreeBibliotheque>>().toEqualTypeOf<EntreeBibliotheque>();
  });

  it("entrée complète valide (choix avec et sans signature) → lue, égale", () => {
    const e = entreeComplete();
    expect(lireEntreeBibliotheque(avec(e))).toEqual(e);
  });

  it("entrée minimale valide → lue", () => {
    const e = entreeMinimale();
    expect(lireEntreeBibliotheque(avec(e))).toEqual(e);
  });

  it("absente, vide ou illisible → null", () => {
    for (const v of [undefined, null, {}, "x", [], avec({}), avec(null), avec("x"), avec([]), 42]) {
      expect(lireEntreeBibliotheque(v)).toBeNull();
    }
  });

  it("strict : champ en trop partout → null", () => {
    const cas: ((e: any) => void)[] = [
      (e) => { e.extra = 1; },
      (e) => { e.profil.extra = 1; },
      (e) => { e.profil.blocs.texteEcran.extra = 1; },
      (e) => { e.profil.blocs.extraits.extra = 1; },
      (e) => { e.profil.blocs.habillage.extra = 1; },
      (e) => { e.profil.blocs.calques.extra = 1; },
      (e) => { e.profil.capacites["texte.surlignage"].extra = 1; },
      (e) => { e.profil.plafonds.extra = 1; },
      (e) => { e.profil.memoire.extra = 1; },
      (e) => { e.recents[0].extra = 1; },
      (e) => { e.choix[0].extra = 1; },
    ];
    for (const m of cas) {
      const e = clone(entreeComplete());
      m(e);
      expect(lireEntreeBibliotheque(avec(e))).toBeNull();
    }
  });

  it("mauvaise version → null", () => {
    const e: any = clone(entreeMinimale());
    e.version = "bibliotheque-video/2";
    expect(lireEntreeBibliotheque(avec(e))).toBeNull();
  });

  it("identifiant de capacité sans point → null (capacites, choix)", () => {
    const a: any = clone(entreeMinimale());
    a.profil.capacites = { surlignage: { permis: true } };
    expect(lireEntreeBibliotheque(avec(a))).toBeNull();
    const b: any = clone(entreeComplete());
    b.choix[0].capacite = "surlignage";
    expect(lireEntreeBibliotheque(avec(b))).toBeNull();
  });

  it("jamais d'échec : getter qui lève, circulaire, sans prototype", () => {
    const piege = { get [CLE_ENTREE_BIBLIOTHEQUE](): unknown { throw new Error("boum"); } };
    expect(() => lireEntreeBibliotheque(piege)).not.toThrow();
    expect(lireEntreeBibliotheque(piege)).toBeNull();

    const interne: any = clone(entreeMinimale());
    Object.defineProperty(interne, "graine", { get() { throw new Error("boum"); }, enumerable: true });
    expect(() => lireEntreeBibliotheque(avec(interne))).not.toThrow();
    expect(lireEntreeBibliotheque(avec(interne))).toBeNull();

    const circ: any = clone(entreeMinimale());
    circ.profil.self = circ;
    expect(() => lireEntreeBibliotheque(avec(circ))).not.toThrow();
    expect(lireEntreeBibliotheque(avec(circ))).toBeNull();
    const circ2: any = {}; circ2.bibliothequeVideo = circ2;
    expect(() => lireEntreeBibliotheque(circ2)).not.toThrow();
    expect(lireEntreeBibliotheque(circ2)).toBeNull();

    const nu = Object.create(null);
    expect(() => lireEntreeBibliotheque(nu)).not.toThrow();
    expect(lireEntreeBibliotheque(nu)).toBeNull();
    const nu2 = Object.create(null); nu2.bibliothequeVideo = Object.assign(Object.create(null), clone(entreeMinimale()));
    expect(() => lireEntreeBibliotheque(nu2)).not.toThrow();
  });

  it("rend une copie, jamais l'objet reçu", () => {
    const e = entreeComplete();
    const lu = lireEntreeBibliotheque(avec(e));
    expect(lu).not.toBeNull();
    expect(lu).not.toBe(e);
    expect(lu!.profil).not.toBe(e.profil);
  });

  it("garde statique : ni rendu, ni services, ni argent", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src/briques/bibliotheque-video/schema.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const specs = [...src.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specs.length).toBeGreaterThan(0);
    for (const sp of specs) {
      expect(sp).not.toMatch(/studio-rendu|@\/services\//);
      expect(sp).not.toMatch(/credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude|image-video/);
      expect(sp).not.toBe("@/briques/bibliotheque-video");
    }
  });
});
