/**
 * BR-DESSIN-FACECAM-b-v20a : en face caméra, quand le dessin est permis (`planScenes.facecamDessin`, ÉTEINT), le plan de
 * scènes filtré passe SOUS les sous-titres (calque texte) au lieu de l'image. Éteint : identique au caractère près.
 * Chemin réel : `avancerChaine` (simulée, aucun réseau, zéro euro) puis rendu statique de `TexteCompose`.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const reglages: Record<string, unknown> = {};
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  lireParametre: async (cle: string, defaut: unknown) => (cle in reglages ? reglages[cle] : defaut),
}));
import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { ParametresDemandeComposition, ProprietesTexteComposition } from "@/briques/composition/scene";
import { parametresComposition } from "@/briques/composition/parametres";
import { instantsTexte } from "../../studio-rendu/src/composition/texte-instants";
import { profilNeutre } from "@/briques/bibliotheque-video/profils/neutre";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { ReponseClaude } from "@/fournisseurs/claude/client";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { servicesFacecam } from "@/moteurs/montage-facecam/dependances";
import "@/services/facecam-branchements";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge. En moyenne, une PME gagne 5 heures par semaine. Et elle réduit ses relances de 30 %.";

function commande(entrees: Record<string, unknown> = {}): CommandeFabrication {
  return {
    videoId: "v-dessin", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE }, distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-dessin/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null }, entrees, reglages: {}, plans: [], prononciations: [],
    sousTitres: { base: "karaoke", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

function outilsRendu(): OutilsMontage & { soumises: DemandeRendu[] } {
  let t = 0;
  const simule = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    soumises,
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), simule.soumettre(d)), etat: (id) => simule.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

async function jusquAuBout(deps: DependancesChaine, c: CommandeFabrication): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const scene = (id: string, premier: number, dernier: number, debutMs: number, finMs: number, position: string) => ({ id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position, piece: "carte-kpi", parametres: { valeur: "42", etiquette: id } });
/**
 * « haut » : hors visage et hors bande des sous-titres ; « bas » : sur la bande des sous-titres ; la 3e pièce tombe
 * pendant l'écran partagé que la chaîne pose seule (mots 40 à 46, vers 16 à 19 s).
 */
const PLAN = { version: "plan-scenes-1", scenes: [scene("haut-libre", 0, 3, 500, 2500, "haut"), scene("sur-soustitres", 4, 8, 3000, 5500, "bas"), scene("pendant-carte", 40, 46, 16000, 19000, "haut")] };
const llm = () => ({ appeler: async (): Promise<ReponseClaude> => ({ texte: JSON.stringify(PLAN), stopReason: "end_turn" }) as ReponseClaude });
type Plan = { scenes: { id: string }[] };
const composition = (o: { soumises: DemandeRendu[] }) => o.soumises.find((d) => (d.parametres as { mode?: string }).mode === "complet")!.parametres as unknown as ParametresDemandeComposition & { image: { planScenes?: Plan }; texte: ProprietesTexteComposition };
const idsImage = (o: { soumises: DemandeRendu[] }) => composition(o).image.planScenes?.scenes.map((s) => s.id);
const idsTexte = (o: { soumises: DemandeRendu[] }) => (composition(o).texte.planScenes as Plan | undefined)?.scenes.map((s) => s.id);

/** Entrée bibliothèque figée dont le profil PERMET `plan-scenes.facecam` (le profil neutre ne le permet pas). */
const entreePermise = () => {
  const profil = profilNeutre("facecam");
  return { bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: { ...profil, capacites: { ...profil.capacites, "plan-scenes.facecam": { ...profil.capacites["plan-scenes.facecam"], permis: true } } }, recents: [], graine: "G", figeeLe: "2026-11-18" } };
};
const entreeFermee = () => ({ bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil: profilNeutre("facecam"), recents: [], graine: "G", figeeLe: "2026-11-18" } });

async function fabriquer(option: { dessin?: true } | undefined, entrees: Record<string, unknown> = {}) {
  const o = outilsRendu();
  const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: o, planScenes: async () => ({ appeler: llm().appeler, ...option }) }, commande(entrees));
  expect(etat.fini).toBe(true);
  return { o, etat };
}


const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, useCurrentFrame: () => 25, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 1500, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { createElement } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : ({} as typeof import("react"));
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const { renderToStaticMarkup } = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : ({} as typeof import("react-dom/server"));
// Chemin calculé : tsc (projet racine) ne suit pas ces imports (PIEGE-REMOTION-TSC.md).
const chemin = (c: string) => `../../studio-rendu/compositions/${c}`;
const TEXTE_COMPOSE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("commune/TexteCompose")) : null;
const PLAN_SOUS_TEXTE = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("commune/PlanSousTexte")) : null;
const SOUS_TITRES = AVEC_RENDU ? await import(/* @vite-ignore */ chemin("sous-titres/CalqueSousTitres")) : null;
const html = (el: unknown) => renderToStaticMarkup(el as never);
const empreinte = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const sansPlan = (t: ProprietesTexteComposition): ProprietesTexteComposition => { const { planScenes: _p, ...reste } = t; return reste; };

/** Empreintes ÉTEINTES relevées sur origin/master 1b772eee AVANT le changement (BR-DESSIN-FACECAM-b-v20a). */
const MASTER = { html: "7a5c8421c4d737c9", instants: "a187513c62fb57bb" };

describe.skipIf(!AVEC_RENDU)("Face caméra · plan de scènes SOUS les sous-titres (BR-DESSIN-FACECAM-b-v20a)", () => {
  const rendre = (t: ProprietesTexteComposition) => html(createElement(TEXTE_COMPOSE!.TexteCompose, t));

  it("(a) éteint : image.planScenes comme sur master, texte.planScenes et marqueur absents, HTML et instants figés", async () => {
    const { o, etat } = await fabriquer(undefined);
    expect(etat.habillage!.base.supplements?.planScenes).toBe(etat.planScenes!.plan);
    expect("planScenesSousTexte" in (etat.habillage!.base.supplements ?? {})).toBe(false);
    expect(idsImage(o)).toEqual(["haut-libre", "sur-soustitres", "pendant-carte"]);
    expect(composition(o).texte.planScenes).toBeUndefined();
    const texte = composition(o).texte;

    expect(empreinte(rendre(texte))).toBe(MASTER.html);
    expect(empreinte(JSON.stringify(instantsTexte(texte)))).toBe(MASTER.instants);
  });

  it("(b) dessin: true : texte.planScenes = plan filtré, image.planScenes absent, plan AVANT les sous-titres", async () => {
    const { o, etat } = await fabriquer({ dessin: true }, entreePermise());
    expect(idsTexte(o)).toEqual(["haut-libre"]);
    expect(idsImage(o)).toBeUndefined();
    expect(composition(o).image.planScenes).toBeUndefined();
    expect(etat.habillage!.base.supplements?.planScenesSousTexte).toBe(true);
    const texte = composition(o).texte;
    const page = rendre(texte);
    const plan = html(createElement(PLAN_SOUS_TEXTE!.PlanSousTexte, { plan: texte.planScenes, t: 1, largeur: texte.largeur, hauteur: texte.hauteur }));
    const sous = html(createElement(SOUS_TITRES!.CalqueSousTitres, { donnees: texte.sousTitres, instantSec: 1 }));
    expect(plan.length).toBeGreaterThan(0);
    expect(sous.length).toBeGreaterThan(0);
    expect(page.indexOf(plan)).toBeGreaterThanOrEqual(0);
    expect(page.indexOf(sous)).toBeGreaterThan(page.indexOf(plan));
  });

  it("(c) instants : le plan s'anime (≥ 2 instants entre 0,5 et 2,5 s), mêmes instants hors des pièces", async () => {
    const { o } = await fabriquer({ dessin: true }, entreePermise());
    const texte = composition(o).texte;
    expect(texte.planScenes).toBeDefined();
    const avec = instantsTexte(texte);
    const sans = instantsTexte(sansPlan(texte));
    expect(avec.instants.filter((t) => t >= 0.5 && t <= 2.5).length).toBeGreaterThanOrEqual(2);
    const fenetres = (texte.planScenes as unknown as { scenes: { debutMs: number; finMs: number }[] }).scenes;
    // La 1re image après la pièce est un instant de plus (le plan disparaît) : elle est comptée avec la pièce.
    const dehors = (l: number[]) => l.filter((t) => !fenetres.some((f) => t * 1000 >= f.debutMs - 1 && t * 1000 <= f.finMs + 41));
    expect(dehors(avec.instants)).toEqual(dehors(sans.instants));
    console.log(`SURCOUT v20a : ${avec.instants.length} images rendues avec le plan, ${sans.instants.length} sans (+${avec.instants.length - sans.instants.length}).`);
  });
});

describe("Face caméra · plan sous le texte : cas fermés (BR-DESSIN-FACECAM-b-v20a)", () => {
  it("(d) entrée bibliothèque qui ne permet pas `plan-scenes.facecam` : comme éteint", async () => {
    const { o, etat } = await fabriquer({ dessin: true }, entreeFermee());
    expect("planScenesSousTexte" in (etat.habillage!.base.supplements ?? {})).toBe(false);
    expect(idsImage(o)).toEqual(["haut-libre", "sur-soustitres", "pendant-carte"]);
    expect(composition(o).texte.planScenes).toBeUndefined();
  });

  it("(e) cas concret / entrée sans marqueur : image.planScenes inchangé, jamais texte.planScenes", async () => {
    const { etat } = await fabriquer(undefined);
    const plan = etat.planScenes!.plan!;
    const c = commande();
    const p = parametresComposition(c, { ratio: "9:16", plans: [], segments: [], dureeSec: 12, planScenes: plan }, RECETTE_COMPOSITION_FACECAM);
    expect(p.image.planScenes).toBe(plan);
    expect(p.texte.planScenes).toBeUndefined();
  });

  it("marqueur posé : le plan passe au texte, jamais aux deux", async () => {
    const { etat } = await fabriquer(undefined);
    const plan = etat.planScenes!.plan!;
    const p = parametresComposition(commande(), { ratio: "9:16", plans: [], segments: [], dureeSec: 12, planScenes: plan, planScenesSousTexte: true }, RECETTE_COMPOSITION_FACECAM);
    expect(p.image.planScenes).toBeUndefined();
    expect(p.texte.planScenes).toBe(plan);
  });
});
