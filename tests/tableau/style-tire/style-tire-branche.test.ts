/**
 * BR-TABLEAU-STYLE-a (18/11) : le tirage du style du tableau est BRANCHÉ au découpage réel, derrière `tableau.styleTire`
 * (ALLUMÉ par défaut depuis ALLUMER-INV-GROUPE-v21p ; `false` écrit en base éteint, lecture en échec = éteint). PAR LE CHEMIN RÉEL : `decouperScriptTableau` puis la boucle de fond
 * `travaillerTachesTableau` (donc `executerDecoupage` : lecture du réglage, historique, note du style), dépôts en mémoire,
 * double de Claude, aucun appel payant. Puis la fiche enregistrée suit la chaîne de fabrication (pages, mise en page,
 * propriétés de `TableauScene`, sous-titres) et le calque texte est rendu « par instants » (`instantsTexte` : une image par
 * état, recopiée par FFmpeg) pour montrer que les sous-titres restent ceux d'un seul style.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereTexte } from "@/domaine/relecture-tableau";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import { coutPireDecoupageUsd, type OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { avecStyleDeLaSerie } from "../../../src/moteurs/montage-tableau/decoupage";
import { fondSousTitresTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { centreBandePct, commandeTableau, fabriquerTableau, pagesDuStyle, plansTableau, RECETTE_COMPOSITION_TABLEAU, segmentsSousTitresTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { bandeDe, sousTitresTableau, supplementsSousTitresTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { contexteBanc } from "../banc/fiches-banc";
import { doubles } from "../fabriquer/doubles";
import { motsRealistes } from "../reference-3/fiches";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";
import { instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, travaillerTachesTableau, lireBrouillonTableau, entreeDecoupage, coutDecoupageCentimes, PARAM_STYLE_TIRE_TABLEAU } = await import("@/services/tableau-creation");
const { historiqueStylesTableau, CLE_HISTORIQUE_STYLES } = await import("@/services/tableau-variete");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "tableau-style-tire";
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

/** Double de Claude : la fiche d'exemple, champs fixes recopiés de la demande ; AUCUN style de tableau (c'est au code de le poser). */
const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  delete (f as { styleTableau?: string }).styleTableau;
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

/** Une vidéo découpée par le chemin réel : le prix, l'accord, la tâche de fond ; rend la fiche enregistrée. */
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

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

const CONTROLE = { aujourdhui: AUJOURDHUI_EXEMPLES, sourcesChiffres: [], preuves: [], matieres: [] };

describe("(a) éteint = identique", () => {
  it("la clé est « tableau.styleTire »", () => expect(PARAM_STYLE_TIRE_TABLEAU).toBe("tableau.styleTire"));

  it("entreeDecoupage sans 6e paramètre : aucun champ `tirage`, objet identique à celui d'avant", () => {
    const sans = entreeDecoupage(donnees as never, "v-a", "b1", CONTROLE, []);
    expect("tirage" in sans).toBe(false);
    expect(entreeDecoupage(donnees as never, "v-a", "b1", CONTROLE, [], undefined)).toEqual(sans);
    expect(entreeDecoupage(donnees as never, "v-a", "b1", CONTROLE, [], { historique: [] })).toEqual({ ...sans, tirage: { historique: [] } });
  });

  it("le prix au pire est le même au centime : les appels du prix ne passent pas le tirage", () => {
    const sans = entreeDecoupage(donnees as never, "v-prix", "b1", CONTROLE, []);
    expect(coutPireDecoupageUsd(entreeDecoupage(donnees as never, "v-prix", "b1", CONTROLE, [], { historique: [] }))).toBe(coutPireDecoupageUsd(sans));
    expect(coutDecoupageCentimes(0.92)).toBeGreaterThan(0);
  });

  it("chemin réel, réglage `false` écrit : la fiche n'a pas de style tiré et l'historique reste vide", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    const a = await decouper();
    const b = await decouper({ ...donnees, texte: `${donnees.texte} ` });
    expect(a.fiche.styleTableau).toBeUndefined();
    expect(b.fiche.styleTableau).toBeUndefined();
    expect(await historiqueStylesTableau()).toEqual([]);
  });

  it("chemin réel, réglage absent (ALLUMER-INV-GROUPE-v21p, défaut allumé) : un style est tiré et noté dans l'historique", async () => {
    const a = await decouper();
    expect(STYLES_TABLEAU).toContain(a.fiche.styleTableau as StyleTableau);
    expect((await historiqueStylesTableau()).at(-1)).toEqual({ videoId: a.videoId, style: a.fiche.styleTableau });
  });

  it("réglage `null` écrit : vaut absent (`?? défaut`), donc allumé ; seul `false` écrit éteint", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, null);
    expect((await decouper()).fiche.styleTableau).toBeDefined();
  });

  it.each([["false", false], ["'true'", "true"], ["1", 1]])("réglage %s : éteint (seul `true` exact allume ; `false` écrit éteint)", async (_n, valeur) => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, valeur);
    const a = await decouper();
    expect(a.fiche.styleTableau).toBeUndefined();
    expect(await historiqueStylesTableau()).toEqual([]);
  });
});

describe("(b) allumé : le tableau change d'une vidéo à l'autre (chemin réel)", () => {
  it("avec 3 dernières vidéos sur tableau blanc, la fiche découpée porte un autre style, noté dans l'historique", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
    await ecrireParametre(CLE_HISTORIQUE_STYLES, ["x1", "x2", "x3"].map((videoId) => ({ videoId, style: "tableau-blanc" })));
    const v = await decouper();
    expect(STYLES_TABLEAU).toContain(v.fiche.styleTableau as StyleTableau);
    expect(v.fiche.styleTableau).not.toBe("tableau-blanc");
    expect((await historiqueStylesTableau()).at(-1)).toEqual({ videoId: v.videoId, style: v.fiche.styleTableau });
  });

  it("deux vidéos de suite (même série, même texte) n'ont pas le même tableau ; jamais celui des 2 dernières", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
    const a = await decouper();
    const b = await decouper({ ...donnees, texte: `${donnees.texte} ` });
    const c = await decouper({ ...donnees, texte: `${donnees.texte}  ` });
    expect(new Set([a.fiche.styleTableau, b.fiche.styleTableau, c.fiche.styleTableau]).size).toBe(3);
    expect(b.fiche.styleTableau).not.toBe(a.fiche.styleTableau);
    expect(c.fiche.styleTableau).not.toBe(b.fiche.styleTableau);
    expect(c.fiche.styleTableau).not.toBe(a.fiche.styleTableau);
  });

  it("même vidéo, même historique → même style (graine)", () => {
    const e = entreeDecoupage(donnees as never, "v-graine", "b1", CONTROLE, [], { historique: ["x1", "x2", "x3"].map((videoId) => ({ videoId, style: "tableau-blanc" as const })) });
    const brute = { habillage: e.habillage };
    const s1 = (avecStyleDeLaSerie(brute, e) as { styleTableau?: string }).styleTableau;
    expect(s1).not.toBe("tableau-blanc");
    expect((avecStyleDeLaSerie(brute, entreeDecoupage(donnees as never, "v-graine", "b2", CONTROLE, [], e.tirage)) as { styleTableau?: string }).styleTableau).toBe(s1);
  });

  it("(c) un style imposé est respecté (le tirage ne le change pas)", () => {
    const e = { ...entreeDecoupage(donnees as never, "v-imp", "b1", CONTROLE, [], { historique: [] }), styleImpose: "paperboard" };
    expect((avecStyleDeLaSerie({ habillage: e.habillage }, e) as { styleTableau?: string }).styleTableau).toBe("paperboard");
  });

  it("une lecture du réglage qui lève vaut éteint : le découpage aboutit, sans style tiré", async () => {
    const parametres = depots().parametres;
    const vraie = parametres.obtenir.bind(parametres);
    const lecture = vi.spyOn(parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === PARAM_STYLE_TIRE_TABLEAU) throw new Error("panne");
      return vraie(id);
    });
    try {
      const v = await decouper();
      expect(v.fiche.styleTableau).toBeUndefined();
    } finally {
      lecture.mockRestore();
    }
  });

  it("la note du style qui lève ne bloque pas le découpage", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const parametres = depots().parametres;
    const enregistrer = parametres.enregistrer.bind(parametres);
    const ecriture = vi.spyOn(parametres, "enregistrer").mockImplementation(async (p) => {
      if (p.id === CLE_HISTORIQUE_STYLES) throw new Error("panne d'écriture");
      return enregistrer(p);
    });
    try {
      const v = await decouper();
      expect(STYLES_TABLEAU).toContain(v.fiche.styleTableau as StyleTableau);
      expect(erreur.mock.calls.some((c) => String(c[0]).includes("style non noté"))).toBe(true);
    } finally {
      ecriture.mockRestore();
      erreur.mockRestore();
    }
  });
});

/** La fiche enregistrée par le chemin réel, calée, mise en page, propriétés de TableauScene et calque texte (comme `sortieV6616`). */
function chaine(f: FicheTableau) {
  const lue = pagesDuStyle(f) as FicheTableau;
  const mots = motsRealistes(lue, 20.5);
  const cal = calerFicheTableau(lue, mots, { contexte: contexteBanc(lue, []), dureeSec: mots.at(-1)!.finSec + 0.3 });
  if (!cal.ok) throw new Error(`calage refusé : ${cal.problemes.join(" | ")}`);
  const fc = cal.fiche;
  const mise = mettreEnPage(fc, {});
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fc.scenes as SceneCalee[], heures: cal.elements, stylo: fc.stylo, mots, temps3: tempsReference3(fc, mots) });
  const fs = formatSortie("vertical");
  const reseaux = reseauxVerticaux();
  const texte = fc.scenes.map((s) => s.texteDit).join(" ");
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const bande = bandeDe(mise, fs.ratio, true, reseaux);
  const st = sousTitresTableau({ fiche: fc, positionPct: centreBandePct(mise), bande });
  const c = commandeTableau({ videoId: "v-style", fiche: fc, texteScript: texte, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio, bandeSousTitres: bande, intensite: "sobre" });
  const supplements = supplementsSousTitresTableau({ st, mise, ratio: fs.ratio, verticale: true, dynamiques: true });
  const segments = segmentsSousTitresTableau({ c, st, dynamiques: true, texte, dureeSec, mots, ratio: fs.ratio, reseaux, scenes, mise, supplements });
  const calque = parametresComposition(c, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: scenes[0].cle }, ...supplements }, RECETTE_COMPOSITION_TABLEAU).texte;
  return { fiche: fc, props, st, calque };
}

describe("(d) de bout en bout : le style tiré arrive aux propriétés de TableauScene et au calque texte « par instants »", () => {
  it("la fiche jugée porte le style ; pagesDuStyle, la mise en page et chaque TableauScene le reçoivent ; le calque texte est rendu par instants", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
    await ecrireParametre(CLE_HISTORIQUE_STYLES, ["x1", "x2", "x3"].map((videoId) => ({ videoId, style: "tableau-blanc" })));
    const v = await decouper();
    const style = v.fiche.styleTableau as StyleTableau;
    expect(style).not.toBe("tableau-blanc");
    const { fiche: fc, props, st, calque } = chaine(v.fiche);
    expect(fc.styleTableau).toBe(style);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(JSON.stringify(p.styleReference)).toContain(style);
    // Les sous-titres suivent le fond du style tiré (un seul style de sous-titres, posé sur le décor choisi).
    expect(st).toBeTruthy();
    expect(fondSousTitresTableau(fc).style).toBe(style);
    const rendu = instantsTexte(calque as never);
    expect(rendu.instants.length).toBeGreaterThan(1);
    expect(rendu.durees.reduce((a, b) => a + b, 0)).toBe((calque as { images: number }).images);
  });
});

/** Styles lus dans les propriétés de CHAQUE scène soumise au rendu par la VRAIE fabrication (`fabriquerTableau`). */
async function stylesFabriques(f: FicheTableau): Promise<{ styles: string[]; parametres: string }> {
  const d = doubles(f);
  await fabriquerTableau({ ...d.outils, lireFiche: async () => structuredClone(f) });
  const scenes = d.scenesSoumises();
  const styles = scenes.map((s) => (s.parametres as unknown as { proprietes: { styleReference: { tableau: { style: string } } } }).proprietes.styleReference.tableau.style);
  const parametres = JSON.stringify(scenes.map((s) => s.parametres)).split(f.videoId).join("VIDEO");
  return { styles, parametres };
}

describe("(d bis) par la vraie fabrication : fabriquerTableau soumet au rendu des scènes qui portent le style tiré", () => {
  it("(i) allumé, deux vidéos de suite : chaque vidéo a un seul style dans toutes ses scènes, égal à fiche.styleTableau, et les deux diffèrent", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, true);
    const a = await decouper();
    const b = await decouper({ ...donnees, texte: `${donnees.texte} ` });
    const fa = await stylesFabriques(a.fiche);
    const fb = await stylesFabriques(b.fiche);
    expect(fa.styles.length).toBeGreaterThan(0);
    expect(new Set(fa.styles)).toEqual(new Set([a.fiche.styleTableau]));
    expect(new Set(fb.styles)).toEqual(new Set([b.fiche.styleTableau]));
    expect(a.fiche.styleTableau).not.toBe(b.fiche.styleTableau);
  });

  it("(ii) éteint (`false` écrit), deux vidéos de suite : un seul et même style, celui de la série", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    const a = await decouper();
    const b = await decouper({ ...donnees, texte: `${donnees.texte} ` });
    const fa = await stylesFabriques(a.fiche);
    const fb = await stylesFabriques(b.fiche);
    expect(fa.styles.length).toBeGreaterThan(0);
    expect(new Set([...fa.styles, ...fb.styles]).size).toBe(1);
  });

  it("(iii) éteint : réglage `false` et réglage `'true'` donnent des paramètres de scènes identiques (videoId mis à part)", async () => {
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, false);
    const absent = await stylesFabriques((await decouper()).fiche);
    reinitialiserDepots();
    const { texteScript: _s, ...regles } = contexteExemple(fiche);
    void _s;
    for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
    for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
    await ecrireParametre(PARAM_STYLE_TIRE_TABLEAU, "true");
    const faux = await stylesFabriques((await decouper()).fiche);
    expect(faux.parametres).toBe(absent.parametres);
    expect(faux.styles).toEqual(absent.styles);
  });
});
