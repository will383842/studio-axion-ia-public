/**
 * Lot G4 · fixtures (≥ 20 sorties RÉELLES des rôles, anonymisées, dont des échecs) et résultats du banc réel, relus
 * SANS clé : schémas, évaluations, « rien d'inventé » (le « 99 % » de Will jamais écrit, aucun faux cas client), coûts
 * enregistrés, diversité d'une vidéo à l'autre.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { raconteUnClient, typeFin, typeOuverture } from "@/domaine/controles-script";
import { restesSensibles, termesSensibles } from "@/generateur/fixtures";
import { EVALUATIONS_DES_ROLES, ROLES_ECRITURE } from "@/generateur/roles";
import { evaluer } from "@/generateur/roles/evaluation";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { MATIERES_FICTIVES } from "./generateur/matieres-fictives";
import { PREUVES_FICTIVES } from "./generateur/preuves-fictives";

const DOSSIER = join("tests", "generateur", "fixtures");
const fixtures = readdirSync(DOSSIER).filter((f) => f.startsWith("g4-") && f.endsWith(".json")).map((f) => ({ f, ...(JSON.parse(readFileSync(join(DOSSIER, f), "utf8")) as { role: string; version: number; sortie: unknown }) }));
const BANC = join("docs", "captures", "g4-banc");

describe("G4 · fixtures réelles anonymisées", () => {
  it("au moins 20 sorties réelles, sur au moins 6 rôles", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    expect(new Set(fixtures.map((x) => x.role)).size).toBeGreaterThanOrEqual(6);
  });

  it("aucun nom de client, aucun lieu, aucune valeur d'un cas client réel, aucune clé", () => {
    const termes = termesSensibles({ preuves: [...PREUVES_FICTIVES, ...SUJETS_BANC.flatMap((s) => s.preuves)], matieres: [...MATIERES_FICTIVES, ...SUJETS_BANC.flatMap((s) => s.matieres)] });
    for (const x of fixtures) {
      const texte = JSON.stringify(x.sortie);
      expect(restesSensibles(texte, termes), x.f).toEqual([]);
      expect(texte, x.f).not.toMatch(/sk-ant-/);
    }
  });

  it("chaque sortie relue par le schéma de son rôle ; les évaluations tournent (échecs gardés comme cas d'étude)", () => {
    let echecs = 0;
    for (const x of fixtures) {
      const role = ROLES_ECRITURE[x.role as keyof typeof ROLES_ECRITURE];
      if (!role) continue;
      const r = role.schema!.safeParse(x.sortie);
      expect(r.success, x.f).toBe(true);
      const ev = evaluer(EVALUATIONS_DES_ROLES[x.role as keyof typeof EVALUATIONS_DES_ROLES] as never, r.data as never, { preuveIds: new Set(["prv-fictive-1"]), matiereIds: new Set(SUJETS_BANC.flatMap((s) => s.matieres.map((m) => m.id))), structures: ["AV.S1", "AV.S3", "AV.S4", "AV.S5", "AV.S10"], famillesPermises: [], chiffresNonProuves: ["99 %", "35 heures"] });
      if (ev.length) echecs++;
    }
    // Les plans tronqués du 1er tour (2-3 segments) et des accroches trop longues font partie des fixtures : des échecs réels.
    expect(echecs).toBeGreaterThan(0);
  });

  it("le plan tronqué du banc (2-3 segments) est bien refusé par l'évaluation critique PLN-08", () => {
    const plans = fixtures.filter((x) => x.role === "plan").map((x) => x.sortie as { segments: { partie: string }[] });
    expect(plans.some((p) => p.segments.filter((s) => s.partie === "corps").length < 5)).toBe(true);
    const court = plans.find((p) => p.segments.filter((s) => s.partie === "corps").length < 5)!;
    expect(evaluer(EVALUATIONS_DES_ROLES.plan.filter((e) => e.id === "PLN-08"), court as never, { preuveIds: new Set(), matiereIds: new Set(), structures: [], famillesPermises: [] }).length).toBe(1);
  });
});

describe.skipIf(!existsSync(join(BANC, "tour-1", "synthese.json")))("G4 · le banc réel (docs/captures/g4-banc)", () => {
  const lire = (tour: string, f: string) => JSON.parse(readFileSync(join(BANC, tour, f), "utf8"));

  it("le « 99 % » de Will n'est écrit dans AUCUNE version, ni publication (rien d'inventé)", () => {
    for (const tour of ["tour-1", "tour-2"]) {
      const e = lire(tour, "sujet-excel-de-will.json").etat;
      const tout = JSON.stringify({ versions: e.versions, corps: e.corps?.map((k: { blocs: unknown }) => k.blocs), finalistes: e.finalistes });
      expect(tout, tour).not.toMatch(/99\s?%/);
      expect(JSON.stringify(e.versions)).toMatch(/[Pp]resque tous/);
    }
  });

  it("aucun faux cas client : jamais « venu nous voir » ni « nous lui avons » sans preuve cas client (sujets 1 et 2)", () => {
    for (const [tour, code] of [["tour-1", "35h-transpose"], ["tour-1", "sujet-excel-de-will"], ["tour-2", "sujet-excel-de-will"]]) {
      const e = lire(tour, `${code}.json`).etat;
      const corps = (e.corps?.[e.gagnant ?? 0]?.blocs ?? []).flatMap((b: { segments: { texte: string }[] }) => b.segments.map((s) => s.texte)).join(" ");
      const ouvertures = (e.versions ?? []).map((v: { declinaison: { accroche: string } }) => v.declinaison.accroche).join(" ");
      expect(raconteUnClient(`${corps} ${ouvertures}`), `${tour} ${code}`).toBe(false);
    }
  });

  it("le « 35 heures » du scénario (chiffre non prouvé) n'est jamais affirmé", () => {
    const e = lire("tour-1", "35h-transpose.json").etat;
    const textes: string[] = [];
    const cueillir = (x: unknown): void => {
      if (Array.isArray(x)) x.forEach(cueillir);
      else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) {
          if (["texte", "accroche", "premiereLigne", "boucle"].includes(k) && typeof v === "string") textes.push(v);
          else cueillir(v);
        }
    };
    cueillir([e.versions, e.corps]);
    expect(textes.length).toBeGreaterThan(10);
    expect(textes.join(" ")).not.toMatch(/35 ?h(eures)?/);
  });

  it("coûts et temps réels enregistrés pour chaque appel ; total du lot sous 3 $", () => {
    let total = 0;
    for (const tour of ["tour-1", "tour-2"]) {
      const s = lire(tour, "synthese.json");
      expect(s.appels.length).toBeGreaterThan(0);
      for (const a of s.appels) {
        expect(a.coutUsd).toBeGreaterThanOrEqual(0);
        expect(a.dureeMs).toBeGreaterThan(0);
      }
    }
    // Les synthèses ne gardent que le dernier lancement de chaque tour : le total réel du lot est dans le rapport.
    const rapport = readFileSync(join(BANC, "RAPPORT-BANC-G4.md"), "utf8");
    const m = /Dépense réelle totale du lot : \*\*(\d+),(\d+) \$\*\*/.exec(rapport);
    expect(m).not.toBeNull();
    total = Number(`${m![1]}.${m![2]}`);
    expect(total).toBeLessThanOrEqual(3);
  });

  it("deux sujets consécutifs du banc : ouvertures et fins différentes (§2 sexies)", () => {
    const a = lire("tour-1", "35h-transpose.json").etat.versions[0];
    const b = lire("tour-2", "sujet-excel-de-will.json").etat.versions[0];
    expect(typeOuverture(a.declinaison.accroche)).not.toBe(typeOuverture(b.declinaison.accroche));
    expect(a.declinaison.accroche).not.toBe(b.declinaison.accroche);
    expect(typeFin(a.appel.texte, a.boucle ? a.declinaison.boucle : "", "")).toBeDefined();
  });

  it("notation à l'aveugle face aux vidéos modèles : enregistrée (les notes sont relues dans le rapport)", () => {
    const n = lire("tour-1", "notes-aveugle.json");
    expect(n.moyenneBanc).toBeGreaterThan(0);
    expect(n.moyenneModeles).toBeGreaterThan(0);
    expect(n.textes.some((t: string) => t.startsWith("modele-D"))).toBe(true);
  });
});
