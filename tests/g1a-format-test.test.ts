/**
 * G1a : FORMAT FICTIF « test » inscrit depuis `tests/` SEULEMENT, par des données (plan v5 B.4.0, B.0 n° 30).
 * Il traverse la chaîne en simulation (5 réseaux, puis 2 réseaux) sans qu'aucun fichier du générateur central le nomme ;
 * une recherche dans `src/generateur/` (et `src/domaine/controles-script/` quand il existera) des codes de format et des
 * noms de réseau écrits en dur fait partie du test. Le cas `declinaison: "aucune"` : `g1a-format-aucune.test.ts`.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { formatEssai, matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
import { formatGenerateur, inscrireFormat, obtenirFormat, trouverFormat } from "@/formats";
import { listerCodes } from "@/formats/registre-codes";
import { CODES_RESEAU } from "@/reseaux/codes";
import { listerReseaux } from "@/reseaux";

const MDP = "essai-g1a-format-test";

// Inscription PAR DES DONNÉES, depuis les tests : copie des données d'un format existant, famille face caméra, code TST.
inscrireFormat(formatEssai(obtenirFormat("avocat"), "test", "ouverture-fin"));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await depots().matieres.enregistrer(matiere("Un client a supprimé 35 heures de saisie par semaine.", "observation"));
});

describe("format « test » inscrit depuis tests/", () => {
  it("le registre le connaît par son code réservé TST ; sa recette est résolue depuis sa famille", () => {
    const f = formatGenerateur("test");
    expect(f.codeClassement).toBe("TST");
    expect(f.recette.famille).toBe("face-camera");
    expect(f.recette.modesDiction).toEqual(["avatar", "teleprompteur", "trame"]);
    expect(f.recette.segmentsFacultatifsMax).toBe(1);
    expect(f.declinaison).toBe("ouverture-fin");
    expect(trouverFormat("test")).toBeTruthy();
  });

  it("5 réseaux : 5 versions codées 0001-TST-xx, le segment facultatif n'est retenu que là où le réseau le permet", async () => {
    const s = await gen.creerSujet({ idee: "Supprimer la saisie à la main", reseaux: ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"], formatId: "test" });
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === s.id);
    expect(vs.map((v) => v.code).sort()).toEqual(["0001-TST-FB", "0001-TST-IG", "0001-TST-LI", "0001-TST-TT", "0001-TST-YS"]);
    expect(vs.filter((v) => v.segmentFacultatifRetenu).map((v) => v.reseau)).toEqual(["linkedin"]);
    const script = (await depots().scripts.obtenir(r.scriptIds[0]))!;
    expect(script.blocs.map((b) => b.blocRecette)).toEqual(["milieu", "preuve"]);
    for (const v of vs) {
      expect(v.ouverture.map((b) => b.blocRecette)).toEqual(["accroche", "promesse"]);
      expect(v.fin[0].blocRecette).toBe("appel");
      expect(v.versionRecette).toBe(4);
    }
    // « Je lis » et « tu » : corps distincts, suffixes dans l'ordre fixe.
    const tu = await gen.ecrireSujetSimule(s.id, { mode: "teleprompteur", adresse: "tu", reseaux: ["tiktok"] });
    if (!tu.ok) throw new Error(tu.message);
    expect((await depots().variantes.obtenir(tu.varianteIds[0]))?.code).toBe("0001-TST-TT-L-T");
    const [vue] = await gen.listerSujets();
    expect(vue.grille.map((l) => `${l.formatId}/${l.mode}/${l.adresse}`)).toEqual(["test/avatar/vous", "test/teleprompteur/tu"]);
  });

  it("puis 2 réseaux : 2 versions", async () => {
    const s = await gen.creerSujet({ idee: "Un autre sujet", reseaux: ["linkedin", "tiktok"], formatId: "test" });
    const r = await gen.ecrireSujetSimule(s.id);
    if (!r.ok) throw new Error(r.message);
    expect((await depots().variantes.lister((v) => v.scriptMaitreId === s.id)).map((v) => v.code).sort()).toEqual(["0001-TST-LI", "0001-TST-TT"]);
  });

  it("le générateur central ne nomme aucun format, aucun code de format ni aucun réseau en dur", () => {
    const dossiers = ["src/generateur", "src/domaine/controles-script"].filter((d) => existsSync(d));
    expect(dossiers).toContain("src/generateur");
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n)) fichiers.push(p);
      }
    };
    dossiers.forEach(parcourir);
    expect(fichiers.length).toBeGreaterThan(0);
    const codesFormat = listerCodes().map((e) => e.code);
    const idsFormat = listerCodes().map((e) => e.formatId);
    const reseaux = listerReseaux().flatMap((r) => [r.id, r.nom]);
    const codesReseau = Object.values(CODES_RESEAU);
    for (const f of fichiers) {
      // Les commentaires peuvent parler des formats ; le CODE, jamais.
      const code = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      const chaines = [...code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
      for (const c of chaines) {
        for (const interdit of [...codesFormat, ...idsFormat, ...reseaux, ...codesReseau]) {
          const motif = new RegExp(`(^|[^A-Za-z0-9-])${interdit.replace(/[-]/g, "\\-")}($|[^A-Za-z0-9-])`, /^[A-Z]{2,3}$/.test(interdit) ? "" : "i");
          expect(motif.test(c), `${f} : « ${c} » contient « ${interdit} »`).toBe(false);
        }
      }
    }
  });
});
