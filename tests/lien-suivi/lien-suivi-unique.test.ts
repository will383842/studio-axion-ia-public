/**
 * L2-07 · UN SEUL CONSTRUCTEUR DE LIEN SUIVI (ADR 0002 de l'Usine, tests de contrat T1 à T4).
 *
 * Les fixtures sont celles de l'ADR, recopiées telles quelles (`0002-lien-suivi-unique.fixtures.json`) : jamais éditées ici.
 * La section `arrivee` (T5, T6) concerne le site (L2-09), pas ce dépôt.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { construireLienSuivi, ErreurLienSuivi, type EntreeLienSuivi } from "@/domaine/mesures";
import fixtures from "./0002-lien-suivi-unique.fixtures.json";

type Entree = { type_lien: string; reseau: string; code: string; activite: string; page: string };
const versConstructeur = (e: Entree): EntreeLienSuivi => ({ typeLien: e.type_lien, reseau: e.reseau, code: e.code, activite: e.activite, page: e.page });

const { valides, refus } = fixtures.construction;
const { regles } = fixtures;

describe("T1 · cas valides : l'URL est égale, caractère pour caractère, à la fixture", () => {
  it("au moins 12 lignes", () => expect(valides.length).toBeGreaterThanOrEqual(12));
  for (const l of valides) {
    it(`${l.id}${"note" in l ? " · " + l.note : ""}`, () => expect(construireLienSuivi(versConstructeur(l.entree))).toBe(l.attendu));
  }
});

describe("T2 · refus : un refus attendu ne devient jamais une URL", () => {
  for (const l of refus) {
    it(`${l.id} · ${l.refus}`, () => {
      let rendu: string | undefined;
      let erreur: unknown;
      try {
        rendu = construireLienSuivi(versConstructeur(l.entree));
      } catch (err) {
        erreur = err;
      }
      expect(rendu).toBeUndefined();
      expect(erreur).toBeInstanceOf(ErreurLienSuivi);
      expect((erreur as ErreurLienSuivi).refus).toBe(l.refus);
    });
  }
});

describe("T3 · propriétés de toute URL produite (fixtures + 1 000 entrées tirées dans les listes fermées)", () => {
  // Générateur congruentiel : tirage reproductible.
  let graine = 20261017;
  const hasard = (n: number) => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine % n;
  };
  const choisir = <T,>(liste: readonly T[]): T => liste[hasard(liste.length)];
  const CODES_VERSION = ["0042-TB-IG", "0042-AV-TT", "0005-FC-LI", "123456-CC-FB", "0042-TB-YS-R1", "0001-IV-YS"];
  const CODES_MOT = ["mot-guide", "mot-diagnostic", "mot-a1"];

  const tirees: Entree[] = [];
  while (tirees.length < 1000) {
    const nature = choisir(regles.natures);
    const reseau = choisir(nature === "message" ? regles.reseaux_message : regles.reseaux);
    tirees.push({ type_lien: nature, reseau, code: choisir(nature === "video" ? CODES_VERSION : CODES_MOT), activite: choisir(regles.activites), page: choisir(regles.pages) });
  }

  it("ordre des paramètres exact, aucun « : », aucun `usine:`, aucun `@`, `depuis` seulement sur /fr/appel et jamais `entete`", () => {
    for (const e of [...valides.map((v) => v.entree), ...tirees]) {
      const lien = construireLienSuivi(versConstructeur(e));
      const u = new URL(lien);
      expect([...u.searchParams.keys()], lien).toEqual(e.page === "/fr/appel" ? regles.ordre : regles.ordre.slice(0, 4));
      expect(lien).not.toMatch(/usine:|@|%/);
      expect(lien.slice("https://".length)).not.toContain(":");
      expect(u.searchParams.get("depuis") ?? "").not.toBe("entete");
      if (e.page === "/fr/appel") expect(u.searchParams.get("depuis")).toBe(`${u.searchParams.get("utm_medium")}-${u.searchParams.get("utm_source")}`);
      const nature = e.type_lien.toLowerCase();
      expect(u.searchParams.get("utm_medium")).toBe(nature);
      expect(u.searchParams.get("utm_campaign")).toBe(e.code);
      for (const [cle, valeur] of u.searchParams) {
        expect(valeur, `${cle} dans ${lien}`).toMatch(/^[A-Za-z0-9][A-Za-z0-9-]{0,59}$/);
      }
    }
  });
});

describe("T4 · garde « pas de lien écrit à la main »", () => {
  const racine = join(process.cwd(), "src");
  /** Hors du constructeur : les bases copiées de l'Usine (leurs liens `depuis=entete` sont repris par L2-10). */
  const EXCEPTIONS = new Set(["domaine/mesures.ts", "briques/fins/banque.ts", "donnees/bases-usine/donnees/7-appels.json"]);
  const MOTIFS = [/[?&]utm_(source|medium|campaign|content|term)=/, /searchParams\.(set|append)\(\s*["'](utm_|depuis)/, /[?&]depuis=/];

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return fichiers(chemin);
      return /\.(ts|tsx|json)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
    });
  }

  it("aucun fichier de src/ ne fabrique un lien utm_* ou depuis hors de `construireLienSuivi`", () => {
    const fautifs = fichiers(racine)
      .map((f) => relative(racine, f).split(sep).join("/"))
      .filter((f) => !EXCEPTIONS.has(f))
      .filter((f) => {
        // Les commentaires qui décrivent un lien (« utm_medium=video ») ne fabriquent rien.
        const code = readFileSync(join(racine, f), "utf8").split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
        return MOTIFS.some((m) => m.test(code));
      });
    expect(fautifs).toEqual([]);
  });
});
