/**
 * ALLUMER-INV-GROUPE-v21p : deux défauts passent à « allumé » (valeur par défaut de `lireParametre`, `=== true` gardé) :
 * `facecamAnimee.finDouce` (fin de la vidéo non coupée sèchement) et `tableau.styleTire` (décor tiré d'une vidéo à l'autre).
 * Chemin réel : vraie `outilsFacecamAnimee` et vrai découpage du tableau, dépôts en mémoire, doubles de Claude, 0 appel payant.
 * Une valeur écrite en base garde la priorité : `false` écrit éteint, comme avant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { repereTexte } from "@/domaine/relecture-tableau";
import type { MotHorodate } from "@/domaine/types";
import { STYLES_TABLEAU, type StyleTableau } from "../../src/briques/tableau-scene/trois-styles/styles";
import type { EntreeRole } from "../../src/generateur/roles/types";
import { coutPireDecoupageUsd, type OutilsDecoupage } from "../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../src/moteurs/montage-tableau/fiche";
import { couperPriseV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../tableau/regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, travaillerTachesTableau, lireBrouillonTableau, entreeDecoupage, PARAM_STYLE_TIRE_TABLEAU } = await import("@/services/tableau-creation");
const { historiqueStylesTableau, CLE_HISTORIQUE_STYLES } = await import("@/services/tableau-variete");
const { ecrireParametre } = await import("@/services/_commun");
const { demandeRenduV4, outilsFacecamAnimee, PARAM_FIN_DOUCE_FA, PARAM_CALAGE_AU_MOT_FA } = await import("@/services/facecam-animee");

const RACINE = join(__dirname, "..", "..");
const MDP = "allumer-inv-groupe";
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
const CONTROLE = { aujourdhui: AUJOURDHUI_EXEMPLES, sourcesChiffres: [], preuves: [], matieres: [] };

const compteur = { appels: 0 };
/** Double de Claude : la fiche d'exemple, AUCUN style de tableau (c'est au code de le poser). Compte les appels. */
const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  compteur.appels += 1;
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  delete (f as { styleTableau?: string }).styleTableau;
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

async function decouper(d: unknown = donnees): Promise<{ videoId: string; fiche: FicheTableau }> {
  const relu = repereTexte((d as { texte: string }).texte);
  const prix = await decouperScriptTableau(d, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  const r = await decouperScriptTableau(d, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(`découpage non enregistré : ${JSON.stringify(r)}`);
  await travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
  if (b.tache?.statut !== "terminee") throw new Error(`découpage non terminé : ${JSON.stringify(b.tache)}`);
  return { videoId: r.videoId, fiche: b.versions.at(-1)!.fiche };
}

const outilsFA = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  compteur.appels = 0;
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

const MOTS: MotHorodate[] = [{ mot: "Bonjour", debutSec: 0.2, finSec: 0.6 }, { mot: "à", debutSec: 0.6, finSec: 0.7 }, { mot: "tous", debutSec: 0.7, finSec: 1.5 }, { mot: "merci", debutSec: 1.6, finSec: 4.0 }];

describe("(a) fin douce : allumée par défaut (rien en base)", () => {
  it("(a) outilsFacecamAnimee rend finDouce === true, et calageAuMot reste ABSENT", async () => {
    const o = await outilsFA();
    expect(o.finDouce).toBe(true);
    expect("calageAuMot" in o).toBe(false);
  });

  it("(a) la fin douce prolonge le dernier passage d'au plus 0,6 s et la demande de rendu porte finDouce", async () => {
    const o = await outilsFA();
    const sans = couperPriseV4({ mots: MOTS, dureeSec: 5.5 });
    const avec = couperPriseV4({ mots: MOTS, dureeSec: 5.5, ...(o.finDouce ? { finDouce: true } : {}) });
    const fin = avec.gardes[avec.gardes.length - 1].finSec;
    expect(fin).toBeGreaterThan(sans.gardes[sans.gardes.length - 1].finSec);
    expect(fin).toBeLessThanOrEqual(4.0 + 0.6 + 1 / 30 + 1e-9);
    const base = { idRendu: "r", prise: "u", plan: { duree: 5, prise: { src: "x" } } as never, gardes: avec.gardes, sortie: { urlDepot: "a", cle: "a" }, vignette: { urlDepot: "b", cle: "b" } };
    expect(demandeRenduV4({ ...base, finDouce: true }).parametres).toMatchObject({ finDouce: true });
  });

  it("(b) `false` écrit en base : finDouce absent, outils identiques à ceux d'avant l'allumage", async () => {
    await ecrireParametre(PARAM_FIN_DOUCE_FA, false);
    const o = await outilsFA();
    expect("finDouce" in o).toBe(false);
    expect(Object.keys(o).sort()).toEqual(["appelerRealisateur", "garderMaster", "historique", "plafondClaudeAtteint", "rendre", "reperer", "transcrire", "videos"]);
  });

  it.each([["'true'", "true"], ["1", 1]])("(b) valeur écrite %s : éteint (seul `true` exact allume)", async (_n, valeur) => {
    await ecrireParametre(PARAM_FIN_DOUCE_FA, valeur);
    expect("finDouce" in (await outilsFA())).toBe(false);
  });

  it("(b) lecture du réglage qui lève : éteint (jamais allumé sur une panne)", async () => {
    const parametres = depots().parametres;
    const vraie = parametres.obtenir.bind(parametres);
    const lecture = vi.spyOn(parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === PARAM_FIN_DOUCE_FA) throw new Error("panne");
      return vraie(id);
    });
    const o = await outilsFA();
    lecture.mockRestore();
    expect("finDouce" in o).toBe(false);
  });

  it("(e) calageAuMot (payant) est toujours lu à `false` par défaut ; la chaîne passe outils.finDouce à couperPriseV4 et à rendre", () => {
    const service = readFileSync(join(RACINE, "src/services/facecam-animee.ts"), "utf8");
    expect(service).toMatch(/lireParametre<unknown>\(PARAM_CALAGE_AU_MOT_FA, false\)\) === true/);
    expect(service).toMatch(/lireParametre<unknown>\(PARAM_FIN_DOUCE_FA, true\)\) === true/);
    expect(PARAM_CALAGE_AU_MOT_FA).toBe("facecamAnimee.calageAuMot");
    const chaine = readFileSync(join(RACINE, "src/moteurs/montage-facecam-animee/chaine-v4.ts"), "utf8");
    expect(chaine).toMatch(/\.\.\.\(outils\.finDouce \? \{ finDouce: true \} : \{\}\) \}\);/);
    expect(chaine).toMatch(/idRendu: `fa4-\$\{etat\.demande\.versionId\}\$\{suffixe\}`[^\n]*outils\.finDouce/);
  });
});

describe("(c) décor tiré : allumé par défaut (rien en base)", () => {
  it("(c) rien en base, 3 vidéos sur tableau blanc dans l'historique : la fiche porte un autre style, noté", async () => {
    await ecrireParametre(CLE_HISTORIQUE_STYLES, ["x1", "x2", "x3"].map((videoId) => ({ videoId, style: "tableau-blanc" })));
    const v = await decouper();
    expect(STYLES_TABLEAU).toContain(v.fiche.styleTableau as StyleTableau);
    expect(v.fiche.styleTableau).not.toBe("tableau-blanc");
    expect((await historiqueStylesTableau()).at(-1)).toEqual({ videoId: v.videoId, style: v.fiche.styleTableau });
  });

  it("(c) deux vidéos de suite (rien en base) n'ont pas le même décor", async () => {
    const a = await decouper();
    const b = await decouper({ ...donnees, texte: `${donnees.texte} ` });
    expect(a.fiche.styleTableau).toBeDefined();
    expect(b.fiche.styleTableau).not.toBe(a.fiche.styleTableau);
  });

  it("(c) `false` écrit : aucun style tiré, historique vide (comme avant)", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    const a = await decouper();
    expect(a.fiche.styleTableau).toBeUndefined();
    expect(await historiqueStylesTableau()).toEqual([]);
  });

  it.each([["'true'", "true"], ["1", 1]])("(c) valeur écrite %s : éteint (seul `true` exact allume)", async (_n, valeur) => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, valeur);
    expect((await decouper()).fiche.styleTableau).toBeUndefined();
  });

  it("(c) lecture du réglage qui lève : éteint, le découpage aboutit sans style tiré", async () => {
    const parametres = depots().parametres;
    const vraie = parametres.obtenir.bind(parametres);
    const lecture = vi.spyOn(parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === PARAM_STYLE_TIRE_TABLEAU) throw new Error("panne");
      return vraie(id);
    });
    const a = await decouper();
    lecture.mockRestore();
    expect(a.fiche.styleTableau).toBeUndefined();
  });

  it("(e) le défaut est bien `true` dans le code, `.catch(() => false)` et `=== true` gardés", () => {
    const src = readFileSync(join(RACINE, "src/services/tableau-creation.ts"), "utf8");
    expect(src).toMatch(/lireParametre<unknown>\(PARAM_STYLE_TIRE_TABLEAU, true\)\.catch\(\(\) => false\)\) === true/);
  });
});

describe("(d) AUDIT ARGENT : rien ne coûte plus (± 0 appel)", () => {
  it("(d) même prix au pire au centime : rien en base = `false` écrit", async () => {
    const sans = entreeDecoupage(donnees as never, "v-prix", "b1", CONTROLE, []);
    const avec = entreeDecoupage(donnees as never, "v-prix", "b1", CONTROLE, [], { historique: [] });
    expect(coutPireDecoupageUsd(avec)).toBe(coutPireDecoupageUsd(sans));
  });

  it("(d) même nombre d'appels à Claude, même prix demandé : rien en base ou `false` écrit", async () => {
    const prixDe = async (): Promise<number> => {
      const relu = repereTexte(donnees.texte);
      const p = await decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
      if (p.statut !== "accord-requis") throw new Error("prix attendu");
      return p.centimes;
    };
    const prixAbsent = await prixDe();
    compteur.appels = 0;
    await decouper();
    const appelsAbsent = compteur.appels;
    reinitialiserDepots();
    const { texteScript: _s, ...regles } = contexteExemple(fiche);
    void _s;
    for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
    for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    const prixFaux = await prixDe();
    compteur.appels = 0;
    await decouper();
    expect(compteur.appels).toBe(appelsAbsent);
    expect(prixFaux).toBe(prixAbsent);
    expect(appelsAbsent).toBeGreaterThan(0);
  });

  it("(d) la fin douce ne change pas l'estimation FA : outils identiques, hors finDouce, rien en base ou `false`", async () => {
    const absent = await outilsFA();
    await ecrireParametre(PARAM_FIN_DOUCE_FA, false);
    const faux = await outilsFA();
    const { finDouce: _f, ...resteAbsent } = absent;
    void _f;
    expect(Object.keys(resteAbsent).sort()).toEqual(Object.keys(faux).sort());
    expect("calageAuMot" in absent).toBe(false);
    expect("calageAuMot" in faux).toBe(false);
  });
});
