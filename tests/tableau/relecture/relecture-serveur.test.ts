/**
 * RELIRE LE SCRIPT · TABLEAU ANIMÉ, côté serveur : les contrôles en direct sont GRATUITS (aucun appel, rien d'écrit) et
 * exigent la session ; « Fabriquer » exige le repère « script relu » de la fiche ACTUELLE (il tombe si le texte change),
 * avant même de demander le prix. Dépôts en mémoire, double de Claude : aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { appliquerSaisie, scriptReluDe } from "@/domaine/relecture-script";
import { decouperANouveau, lignesDeLaFiche, lignesDuScriptTableau, lignesDuTexteTableau, repereFiche, repereTexte } from "@/domaine/relecture-tableau";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import { exempleV4 } from "../../tableau-scripts/exemples-v4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: () => true };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const actions = await import("@/app/(studio)/tableau/nouvelle/actions");
const { NouvelleVideoTableau } = await import("@/components/formats/tableau-anime/NouvelleVideoTableau");

const MDP = "relire-tableau";
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

/** Un brouillon découpé (fiche valide), la case « déjà vu » cochée. */
async function brouillonPret(): Promise<string> {
  const relu = repereTexte(donnees.texte);
  const prix = await creation.decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error("prix attendu");
  const r = await creation.decouperScriptTableau(donnees, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error("découpage attendu");
  await creation.travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  await creation.cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
  return r.videoId;
}

const ficheDe = async (videoId: string): Promise<FicheTableau> => creation.lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;

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

describe("contrôles en direct du texte (avant « Découper en scènes »)", () => {
  it("gratuits : aucun appel, rien d'écrit ; le texte de Will est pris tel quel (un mot interdit ne bloque pas)", async () => {
    const avant = lignesDuTexteTableau("Voici un conseil simple. Il marche bien.");
    const apres = appliquerSaisie(avant, "t1", { dit: "Contactez-nous pour en savoir plus." });
    const videos = await depots().videos.compter();
    const r = await actions.controlerTexteTableauAction(scriptReluDe(avant, apres));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees).toEqual([]);
    expect(await depots().videos.compter()).toBe(videos);
  });

  it("script du générateur (brouillon) : les contrôles du gabarit tournent sur le texte relu", async () => {
    const { ecriture, demande } = exempleV4("01-formation");
    const videoId = await brouillonPret();
    const v = (await depots().videos.obtenir(videoId))!;
    const generation = { traceId: "t1", demande, le: "2026-10-15T08:00:00Z", issue: { ok: false, motifs: [], meilleure: { passe: "ecriture", ecriture, defauts: [], valide: true } } };
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...creation.lireBrouillonTableau(v)!, generation } } });
    const avant = lignesDuScriptTableau(ecriture.script);
    const douleur = avant.find((l) => l.groupe === "Douleur")!;
    const apres = appliquerSaisie(avant, douleur.id, { dit: `${douleur.dit} ${"Et encore une phrase qui ajoute beaucoup trop de mots à ce passage déjà plein.".repeat(2)}` });
    const r = await creation.controlerTexteTableau(videoId, scriptReluDe(avant, apres));
    expect(r.map((p) => p.code)).toContain("passage-mots");
    // Sans la session : renvoyé vers la connexion, rien n'est contrôlé.
    reinitialiserRequete();
    await expect(actions.controlerTexteTableauAction(scriptReluDe(avant, apres), videoId)).rejects.toThrow(/connexion/);
  });
});

describe("script écrit par Claude puis retouché : il garde ses contrôles (lignes t…, plus celles du générateur)", () => {
  async function brouillonAvecGeneration(): Promise<string> {
    const { ecriture, demande } = exempleV4("01-formation");
    const videoId = await brouillonPret();
    const v = (await depots().videos.obtenir(videoId))!;
    const generation = { traceId: "t1", demande, le: "2026-10-15T08:00:00Z", issue: { ok: false, motifs: [], meilleure: { passe: "ecriture", ecriture, defauts: [], valide: true } } };
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...creation.lireBrouillonTableau(v)!, generation } } });
    return videoId;
  }
  const retouche = (texte: string, ajout: string) => {
    const avant = lignesDuTexteTableau(texte);
    return scriptReluDe(avant, appliquerSaisie(avant, "t0", { dit: `${avant[0].dit} ${ajout}` }));
  };

  it("texte du générateur retouché + « contactez-nous » : mot interdit bloquant", async () => {
    const { ecriture } = exempleV4("01-formation");
    const videoId = await brouillonAvecGeneration();
    const r = await creation.controlerTexteTableau(videoId, retouche(`${texteDitDe(ecriture.script)} Un mot de plus.`, "Contactez-nous dès demain."));
    expect(r.some((p) => p.niveau === "bloquant" && p.code === "mot-interdit")).toBe(true);
  });

  it("origine « will » (Will a refusé le script de Claude et colle SON texte) : aucun blocage, même avec une génération au brouillon", async () => {
    const videoId = await brouillonAvecGeneration();
    const r = await creation.controlerTexteTableau(videoId, { ...retouche("Voici un conseil simple. Il marche bien.", "Contactez-nous dès demain."), origine: "will" });
    expect(r).toEqual([]);
  });

  it("origine « generateur » ou absente : les contrôles de Claude restent", async () => {
    const { ecriture } = exempleV4("01-formation");
    const videoId = await brouillonAvecGeneration();
    const base = retouche(`${texteDitDe(ecriture.script)} Un mot de plus.`, "Contactez-nous dès demain.");
    for (const origine of ["generateur", undefined]) {
      const r = await creation.controlerTexteTableau(videoId, { ...base, origine });
      expect(r.some((p) => p.niveau === "bloquant" && p.code === "mot-interdit")).toBe(true);
    }
  });

  it("garde-fou serveur : « will » sur le texte de Claude lui-même (rechargement) est ignoré, mot interdit bloquant", async () => {
    const { ecriture } = exempleV4("01-formation");
    const videoId = await brouillonAvecGeneration();
    const sur = `${texteDitDe(ecriture.script)} Contactez-nous dès demain.`;
    const v = (await depots().videos.obtenir(videoId))!;
    const b = creation.lireBrouillonTableau(v)!;
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...b, donnees: { ...b.donnees, texte: sur } } } });
    const r = await creation.controlerTexteTableau(videoId, { ...retouche(sur, ""), origine: "will" });
    expect(r.some((p) => p.niveau === "bloquant" && p.code === "mot-interdit")).toBe(true);
  });

  it("garde-fou serveur : « will » sur le texte dit de Claude, mot pour mot : mêmes contrôles que sans l'origine", async () => {
    const { ecriture } = exempleV4("01-formation");
    const videoId = await brouillonAvecGeneration();
    const lignes = scriptReluDe(lignesDuTexteTableau(texteDitDe(ecriture.script)), lignesDuTexteTableau(texteDitDe(ecriture.script)));
    const sans = await creation.controlerTexteTableau(videoId, lignes);
    const avec = await creation.controlerTexteTableau(videoId, { ...lignes, origine: "will" });
    expect(avec).toEqual(sans);
  });

  it("texte fourni par Will (pas de génération) avec le même mot : aucun blocage", async () => {
    const r = await creation.controlerTexteTableau(undefined, retouche("Voici un conseil simple. Il marche bien.", "Contactez-nous dès demain."));
    expect(r.filter((p) => p.niveau === "bloquant")).toEqual([]);
  });
});

describe("« Découper en scènes » exige le repère du texte relu (comme « Fabriquer »)", () => {
  it("sans repère, ou avec celui d'un autre texte : refus AVANT le prix, rien de créé ; avec le bon : le prix", async () => {
    const videos = await depots().videos.compter();
    const refus = { statut: "refusee", phrase: creation.RAISON_TEXTE_NON_RELU, refus: [] };
    expect(await creation.decouperScriptTableau(donnees, { accord: 999_999 }, { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual(refus);
    expect(await creation.decouperScriptTableau(donnees, { accord: 999_999, relu: repereTexte(`${donnees.texte} Encore une phrase.`) }, { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual(refus);
    expect(await depots().videos.compter()).toBe(videos);
    expect(await creation.decouperScriptTableau(donnees, { relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "accord-requis" });
  });

  it("l'action transmet le repère", async () => {
    expect(await actions.decouperScriptTableauAction(donnees, undefined, undefined, repereTexte(donnees.texte))).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
    expect(await actions.decouperScriptTableauAction(donnees)).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: creation.RAISON_TEXTE_NON_RELU } });
  });

  it("« Découper à nouveau » : texte modifié dans le grand champ → la relecture rouvre, rien ne part ; l'ancien repère est refusé", async () => {
    const videoId = await brouillonPret();
    const b = creation.lireBrouillonTableau((await depots().videos.obtenir(videoId))!)!;
    const modifie = `${b.donnees.texte} Contactez-nous pour en savoir plus.`;
    // L'écran : le texte déjà relu (et découpé) repart avec son repère ; modifié, il se relit d'abord.
    expect(decouperANouveau(b.donnees.texte, b.donnees.texte)).toEqual({ relu: repereTexte(b.donnees.texte) });
    expect(decouperANouveau(`  ${b.donnees.texte.replace(/ /g, "  ")} `, b.donnees.texte)).toEqual({ relu: repereTexte(b.donnees.texte) });
    expect(decouperANouveau(modifie, b.donnees.texte)).toEqual({ relire: true });
    // Le serveur : le texte modifié avec le repère de l'ancien texte est refusé avant le prix, le brouillon intact.
    expect(await creation.decouperScriptTableau({ ...donnees, texte: modifie }, { videoId, accord: 999_999, relu: repereTexte(b.donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual({ statut: "refusee", phrase: creation.RAISON_TEXTE_NON_RELU, refus: [], videoId });
    const apres = creation.lireBrouillonTableau((await depots().videos.obtenir(videoId))!)!;
    expect(apres.donnees.texte).toBe(b.donnees.texte);
    expect(apres.tache).toEqual(b.tache);
  });
});

describe("la raison de la case « déjà vu » : un booléen du serveur, jamais une comparaison de phrases", () => {
  it("case non cochée : `raisonFabriquerCase` vrai ; cochée : faux", async () => {
    const videoId = await brouillonPret();
    expect((await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES })).brouillon).toMatchObject({ raisonFabriquerCase: false });
    await creation.cocherDejaVuTableau(videoId, false, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect((await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES })).brouillon).toMatchObject({ raisonFabriquer: creation.RAISON_CASE_DEJA_VU, raisonFabriquerCase: true });
  });
});

describe("relecture de la fiche, puis « Fabriquer » avec le repère « script relu »", () => {
  const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined, lancer: async () => ({ travailId: "trav-relu" }) };

  it("contrôles de la fiche relancés sur la relecture, sans rien enregistrer", async () => {
    const videoId = await brouillonPret();
    const f = await ficheDe(videoId);
    const avant = lignesDeLaFiche(f);
    expect(await creation.controlerFicheTableau(videoId, scriptReluDe(avant, avant), { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual([]);
    // Le texte dit d'une scène qui ne redit plus le script : la règle « mot pour mot » ou une autre refuse, sur la scène.
    const apres = appliquerSaisie(avant, f.scenes[0].id, { dit: "Un tout autre texte." });
    const p = await creation.controlerFicheTableau(videoId, scriptReluDe(avant, apres), { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.niveau === "bloquant")).toBe(true);
    expect((await ficheDe(videoId)).scenes[0].texteDit).toBe(f.scenes[0].texteDit);
  });

  it("sans repère, ou avec celui d'un autre texte : refus AVANT le prix ; avec le bon : prix, puis lancement", async () => {
    const videoId = await brouillonPret();
    const f = await ficheDe(videoId);
    expect(await creation.fabriquerVideoTableau(videoId, 999_999, deps)).toEqual({ statut: "refusee", phrase: creation.RAISON_SCRIPT_NON_RELU });
    const autre = copie(f);
    autre.scenes[0] = { ...autre.scenes[0], texteDit: `${autre.scenes[0].texteDit} Encore.` };
    expect(await creation.fabriquerVideoTableau(videoId, 999_999, deps, repereFiche(autre))).toEqual({ statut: "refusee", phrase: creation.RAISON_SCRIPT_NON_RELU });
    const prix = await creation.fabriquerVideoTableau(videoId, undefined, deps, repereFiche(f));
    if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
    expect(await creation.fabriquerVideoTableau(videoId, prix.centimes, deps, repereFiche(f))).toMatchObject({ statut: "lancee" });
  });

  it("le repère tombe quand la fiche change (correction enregistrée) : il faut relire la nouvelle", async () => {
    const videoId = await brouillonPret();
    const f = await ficheDe(videoId);
    const relu = repereFiche(f);
    const ligne = f.scenes[0].elements.find((e) => e.type === "ligne")!;
    expect(await creation.corrigerFicheTableau(videoId, [{ sceneId: f.scenes[0].id, lignes: { [ligne.id]: `${(ligne as { texte: string }).texte} !` } }], { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "enregistree" });
    expect(await creation.fabriquerVideoTableau(videoId, 999_999, deps, relu)).toEqual({ statut: "refusee", phrase: creation.RAISON_SCRIPT_NON_RELU });
    expect(await creation.fabriquerVideoTableau(videoId, undefined, deps, repereFiche(await ficheDe(videoId)))).toMatchObject({ statut: "accord-requis" });
  });

  it("l'action transmet le repère", async () => {
    const videoId = await brouillonPret();
    const r = await actions.fabriquerVideoTableauAction(videoId, undefined, repereFiche(await ficheDe(videoId)));
    expect(r).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
    expect(await actions.fabriquerVideoTableauAction(videoId, undefined)).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
  });
});

describe("l'écran : le même « Relire le script » avant le découpage et avant la fabrication", () => {
  const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

  it("un texte sans fiche : une carte par phrase, « Découper en scènes » avec son prix, « Tout réécrire »", async () => {
    const videoId = await brouillonPret();
    const v = (await depots().videos.obtenir(videoId))!;
    const { tache: _t, ...b } = creation.lireBrouillonTableau(v)!;
    void _t;
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...b, versions: [] } } });
    const ecran = await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    const vu = texte(html);
    expect(html).toContain('aria-label="Relire le script"');
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)?.length).toBe(lignesDuTexteTableau(donnees.texte).length);
    expect(vu).toMatch(/Découper en scènes \(≈ [\d,]+ € au plus\)/);
    expect(vu).toContain("Tout réécrire");
    expect(vu).toContain("Texte libre");
    expect(vu).not.toContain("Lancer la vidéo");
  });

  it("une fiche : une carte par scène (la voix dit et ses lignes écrites), « Fabriquer » avec le prix de la voix", async () => {
    const videoId = await brouillonPret();
    const ecran = await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const f = await ficheDe(videoId);
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    const vu = texte(html);
    expect(html.match(/aria-label="Relire le script"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(f.scenes.length);
    expect(vu).toContain(`Page ${f.scenes[0].page}`);
    expect(vu).toMatch(/Fabriquer la vidéo \(≈ [\d,]+ €\)/);
    expect(vu).toContain("Autres corrections");
    expect(vu).not.toContain("Découper en scènes");
  });
});

describe("garde-fou serveur au découpage : l'origine « will » n'est rangée que pour un vrai texte de Will", () => {
  async function avecGeneration(texteRange: string): Promise<string> {
    const { ecriture, demande } = exempleV4("01-formation");
    const videoId = await brouillonPret();
    const v = (await depots().videos.obtenir(videoId))!;
    const generation = { traceId: "t1", demande, le: "2026-10-15T08:00:00Z", issue: { ok: false, motifs: [], meilleure: { passe: "ecriture", ecriture, defauts: [], valide: true } } };
    const b = creation.lireBrouillonTableau(v)!;
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...b, tache: undefined, donnees: { ...b.donnees, texte: texteRange }, generation } } });
    return videoId;
  }
  async function decouper(videoId: string, texte: string, origine?: "will") {
    const d = { ...donnees, texte, ...(origine ? { origine } : {}) };
    const relu = repereTexte(texte);
    const prix = await creation.decouperScriptTableau(d, { videoId, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (prix.statut !== "accord-requis") throw new Error(`prix attendu, reçu ${prix.statut}`);
    const r = await creation.decouperScriptTableau(d, { videoId, accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("en-cours");
    return creation.lireBrouillonTableau((await depots().videos.obtenir(videoId))!)!.donnees.origine;
  }

  it("texte égal au texte dit de Claude : origine « will » non rangée", async () => {
    const { ecriture } = exempleV4("01-formation");
    const dit = texteDitDe(ecriture.script);
    const videoId = await avecGeneration("");
    expect(await decouper(videoId, dit, "will")).toBeUndefined();
  });

  it("texte égal au texte rangé d'un brouillon sans origine « will » (rechargement) : non rangée", async () => {
    const videoId = await avecGeneration(donnees.texte);
    expect(await decouper(videoId, donnees.texte, "will")).toBeUndefined();
  });

  it("vrai texte de Will, même sur un brouillon qui a une écriture : origine « will » rangée", async () => {
    const videoId = await avecGeneration("Un autre texte rangé.");
    expect(await decouper(videoId, donnees.texte, "will")).toBe("will");
  });
});

describe("règle 10 vérifiée GRATUITEMENT avant le prix, sur le texte de Will", () => {
  const debut = "Bonjour à tous et bienvenue sur la chaîne, aujourd'hui je vous parle d'un sujet très précis. ";
  it("origine « will », aucun mot de la douleur dit au début : texte pris à l'identique, jamais refusé (le prix est demandé)", async () => {
    const texte = `${debut}${donnees.texte}`;
    const r = await creation.decouperScriptTableau({ ...donnees, texte, origine: "will" }, { relu: repereTexte(texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("accord-requis");
  });
  it("sans l'origine « will » (texte de Claude) : la règle n'est pas jouée ici, le prix est demandé comme avant", async () => {
    const texte = `${debut}${donnees.texte}`;
    const r = await creation.decouperScriptTableau({ ...donnees, texte }, { relu: repereTexte(texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("accord-requis");
  });
  it("origine « will », mot de la douleur dit au début : le prix est demandé", async () => {
    const r = await creation.decouperScriptTableau({ ...donnees, origine: "will" }, { relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("accord-requis");
  });
});

describe("texte de Will dont le début ne dit pas la douleur : pris à l'identique par le découpage ET la relecture", () => {
  const fv = copie(fiche);
  fv.scenes[0].texteDit = "Vos outils d'IA sont lents ? Voici pourquoi.";
  const donneesWill = { ...donnees, texte: texteScriptDe(fv), origine: "will" as const };
  const appelerWill: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
    const f = copie(fiche);
    Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
    auStyleDemande(f);
    f.scenes[0].texteDit = fv.scenes[0].texteDit;
    for (const e of f.scenes[0].elements) if (e.type === "ligne" && e.bloc === "phrase-cle") Object.assign(e, { texte: "Vos outils d'IA sont vagues ?" });
    return { ok: true, simule: false, donnees: JSON.stringify(f) };
  };

  it("le découpage accepte la fiche (aucun refus de douleur en tête), la relecture ne bloque rien", async () => {
    const prix = await creation.decouperScriptTableau(donneesWill, { relu: repereTexte(donneesWill.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (prix.statut !== "accord-requis") throw new Error("prix attendu");
    const r = await creation.decouperScriptTableau(donneesWill, { accord: prix.centimes, relu: repereTexte(donneesWill.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (r.statut !== "en-cours") throw new Error("découpage attendu");
    await creation.travaillerTachesTableau({ appeler: appelerWill, aujourdhui: AUJOURDHUI_EXEMPLES });
    const f = await ficheDe(r.videoId);
    expect(f.scenes[0].texteDit).toBe(fv.scenes[0].texteDit);
    const lignes = lignesDeLaFiche(f);
    expect(await creation.controlerFicheTableau(r.videoId, scriptReluDe(lignes, lignes), { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual([]);
  });
});
