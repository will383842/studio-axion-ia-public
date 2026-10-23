/**
 * ÉCRAN « NOUVELLE VIDÉO · TABLEAU ANIMÉ » (11/10) : les deux chemins (« J'ai déjà mon texte », « Écrire le script pour
 * moi ») ; l'écriture refusée par le serveur sans confirmation du coût ; le résultat (accroches, script, note, points à
 * préparer, refus) ; une autre accroche relance l'écriture seule ; « Utiliser ce script » remplit le texte ; à la
 * fabrication, les réseaux deviennent les sorties, le mot à commenter et la trace du script sont transmis ; les
 * raccords posent la fin de chaque sortie avec le mot, et la trace écrite par la fabrication arrive en base ; la page
 * de la vidéo montre une vidéo par format ; la tuile mobile n'apparaît que format ouvert. Dépôts en mémoire, doubles de
 * Claude : aucun appel réseau, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { CRITERES_GRILLE, type AngleScript, type EcritureScript } from "@/domaine/scripts-tableau";
import { DEMANDE_MODELE, ecritureModele } from "../../tableau-scripts/modele-valide";
import { repereFiche, repereTexte } from "@/domaine/relecture-tableau";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const aiguillage = vi.hoisted(() => ({ ouvert: true }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

/** Les raccords réels sans les branchements réels (voix, R2, studio-rendu) : seulement ce que la chaîne en lit. */
vi.mock("@/services/tableau-outils", async (original) => {
  const vrai = await original<typeof import("../../../src/services/tableau-outils")>();
  return { ...vrai, branchementsReels: async () => ({ env: "dev", voix: { fournisseurVoix: "simulation" }, scenes: {}, montage: {} }) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
/** Le repère « script relu » de la fiche actuelle du brouillon (« Fabriquer » l'exige). */
const relu = async (videoId: string) => repereFiche(creation.lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche);

const { ecrireScriptTableauAction } = await import("@/app/(studio)/tableau/nouvelle/actions");
const { NouvelleVideoTableau, cheminDeDepart } = await import("@/components/formats/tableau-anime/NouvelleVideoTableau");
const { adresseCreationFormat, listerFormatsNavigation } = await import("@/formats");
const { servicesTableau } = await import("@/moteurs/montage-tableau");
const { sortiesDeLaVersion } = await import("@/services/tableau-vue");
const { SortiesTableau } = await import("@/components/formats/tableau-anime/SortiesTableau");

const MDP = "tableau-raccords-2";
const JETONS = { entree: 1000, cacheLu: 0, cacheEcrit: 2000, sortie: 3000 };
const ANGLE: AngleScript = {
  angle: "Comment apprend-on vraiment à se servir de l'IA ?",
  douleur: "Des réponses plates qu'il faut tout réécrire.",
  accroches: [
    { type: "situation-vecue", dit: "Vous avez essayé l'IA trois fois.", ecran: "Essayé trois fois", pourquoi: "Vécu." },
    { type: "idee-recue-contredite", dit: "L'IA n'est pas un moteur de recherche.", ecran: "Pas un moteur", pourquoi: "Contredit." },
    { type: "chiffre-vrai", dit: "Cinq jours suffisent.", ecran: "Cinq jours", pourquoi: "Méthode." },
    { type: "erreur-frequente", dit: "Vous changez de tâche chaque jour.", ecran: "Une tâche", pourquoi: "Erreur." },
    { type: "promesse-precise", dit: "Un modèle gardé en cinq jours.", ecran: "Un modèle gardé", pourquoi: "Promesse." },
  ],
  retenue: 0,
  raison: "Elle fait dire « c'est moi ».",
};
/** Sortie de la relecture : le script réécrit ENTIER, sans les variantes (gardées de l'écriture). */
const relecture = (e: EcritureScript) => ({ corrections: [], grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: true, remarque: "" })), faiblesses: [], affirmations: e.affirmations, manques: [] });

/** Client du générateur simulé : rend les réponses dans l'ordre et garde les requêtes et leurs passes. */
function clientSimule(sorties: unknown[]) {
  const requetes: { r: RequeteClaude; passe: string }[] = [];
  return {
    requetes,
    client: {
      simule: true,
      async appeler(r: RequeteClaude, passe: string): Promise<ReponseClaude> {
        requetes.push({ r, passe });
        const s = sorties.shift();
        if (s === undefined) throw new Error("Appel de trop.");
        return { texte: JSON.stringify(s), modeleDemande: r.modele, modele: "claude-opus-5-5", replis: [], stopReason: "end_turn", jetons: { ...JETONS } };
      },
    },
  };
}

/** Ce que l'écran du générateur envoie. */
const DEMANDE = { ...DEMANDE_MODELE, vraiCas: null };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  aiguillage.ouvert = true;
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit dans les tests");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function prix(): Promise<number> {
  return (await creation.ecranCreationTableau()).ecriture.coutCentimes;
}

/** « Écrire le script pour moi » puis un passage de la boucle de fond (le client simulé lui est donné). */
async function ecrireEtAttendre(demande: unknown, options: Parameters<typeof creation.ecrireScriptTableau>[1], client: ReturnType<typeof clientSimule>["client"]) {
  const r = await creation.ecrireScriptTableau(demande, options, { client });
  if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
  await creation.travaillerTachesTableau({ client });
  const b = creation.lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
  return { videoId: r.videoId, traceId: r.traceId, statut: b.tache!.statut, generation: b.generation };
}

describe("« Écrire le script pour moi » : le service", () => {
  it("refusé sans confirmation du coût : rien n'est écrit, aucun appel, aucun brouillon", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const cout = await prix();
    expect(cout).toBeGreaterThan(0);
    for (const accord of [undefined, true, false, 0, cout - 1]) {
      const r = await creation.ecrireScriptTableau(DEMANDE, { accord }, { client });
      expect(r).toMatchObject({ statut: "accord-requis", centimes: cout });
    }
    // Par l'action aussi (le chemin de l'écran) : sans montant, rien ne part.
    expect(await ecrireScriptTableauAction(DEMANDE)).toMatchObject({ ok: true, donnees: { statut: "accord-requis" } });
    expect(requetes).toHaveLength(0);
    expect(await depots().videos.compter((v) => v.formatId === "tableau-anime")).toBe(0);
    expect(await depots().tracesScriptsTableau.compter()).toBe(0);
  });

  it("Claude non relié : refus clair, rien d'écrit ni de payé ; demande incomplète : une phrase simple", async () => {
    const cout = await prix();
    expect(await creation.ecrireScriptTableau(DEMANDE, { accord: cout }, { claudeRelie: async () => false })).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/pas relié/) });
    expect(await creation.ecrireScriptTableau({ ...DEMANDE, sujet: "" }, { accord: cout })).toMatchObject({ statut: "refusee", phrase: "Dites le sujet en une ligne." });
    expect(await creation.ecrireScriptTableau({ ...DEMANDE, fin: { type: "commentaire", mot: "deux mots" } }, { accord: cout })).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/mot à commenter/) });
    expect(await depots().videos.compter((v) => v.formatId === "tableau-anime")).toBe(0);
  });

  it("avec le coût confirmé : script écrit, gardé dans le brouillon avec sa trace ; « Utiliser ce script » le remplit", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await ecrireEtAttendre(DEMANDE, { accord: await prix() }, client);
    expect(r.statut).toBe("terminee");
    expect(requetes.map((x) => x.passe)).toEqual(["angle", "ecriture", "relecture"]);
    expect(await depots().tracesScriptsTableau.obtenir(r.traceId)).toMatchObject({ issue: "livre" });

    const ecran = await creation.ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const g = ecran.brouillon!.generation!;
    expect(g.traceId).toBe(r.traceId);
    expect(g.issue.ok && g.issue.resultat.accroches).toHaveLength(5);
    expect(g.proposition).toMatchObject({ serieCode: "automatisations", structure: "demonstration", finId: "fin-if-diagnostic", reseaux: ["verticaux"] });
    // La douleur transmise au découpage est celle que le script DIT (accroche, puis douleur), pas la description de l'angle ;
    // les mots de la douleur du générateur suivent.
    expect(g.proposition!.douleur).toBe("Le seul qui connaît ce dossier client est en congé. Un client appelle. On fouille la boîte mail du collègue. Puis on l'appelle en congé.");
    expect(g.proposition!.motsDouleur).toEqual(["dossier client", "en congé"]);
    // Les parties nommées (v3) suivent jusqu'aux données du découpage, mot pour mot.
    expect(g.proposition!.parties?.map((x) => x.partie)).toEqual(["accroche", "douleur", "solution", "etape", "etape", "etape", "exemple", "a-retenir", "appel"]);
    expect(g.proposition!.parties?.map((x) => x.texte).join(" ")).toBe(g.proposition!.texte);
    // Le titre du brouillon reste le sujet saisi, jamais la douleur.
    expect((await depots().videos.obtenir(r.videoId))!.titre).toBe(creation.titreBrouillon(DEMANDE.sujet));
    expect(g.proposition!.texte).toBe(creation.texteDuScript(g.issue.ok ? g.issue.resultat : (null as never)));
    // La proposition passe la validation de l'écran (le découpage peut partir tel quel).
    expect(creation.validerDonneesScript(g.proposition).ok).toBe(true);
  });

  it("une autre accroche : seule l'écriture est refaite, avec l'accroche choisie", async () => {
    const premier = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await ecrireEtAttendre(DEMANDE, { accord: await prix() }, premier.client);
    if (r.statut !== "terminee") throw new Error("non écrit");
    const second = clientSimule([ecritureModele(), relecture(ecritureModele())]);
    const r2 = await ecrireEtAttendre(DEMANDE, { videoId: r.videoId, accord: await prix(), accroche: 2 }, second.client);
    expect(r2.statut).toBe("terminee");
    expect(second.requetes.map((x) => x.passe)).toEqual(["ecriture", "relecture"]);
    expect(second.requetes[0].r.messages[0].contenu).toContain(ANGLE.accroches[2].dit);
    const g = (await creation.ecranCreationTableau(r.videoId)).brouillon!.generation!;
    expect(g.issue.ok && g.issue.resultat.retenue).toBe(2);
  });

  it("refus du générateur : les raisons sont gardées et dites ; la meilleure version reste affichée, corrigeable", async () => {
    const fautive = ecritureModele();
    fautive.script.accroche[0].dit = "Bonjour à tous, vous avez essayé l'IA.";
    const { client } = clientSimule([ANGLE, fautive, structuredClone(fautive)]);
    const r = await ecrireEtAttendre(DEMANDE, { accord: await prix() }, client);
    expect(r.statut).toBe("refusee");
    const motifs = r.generation!.issue.ok ? [] : r.generation!.issue.motifs;
    expect(motifs.length).toBeGreaterThan(0);
    const ecran = await creation.ecranCreationTableau(r.videoId);
    // La meilleure version est gardée (le travail payé n'est jamais jeté) : affichée, à corriger à la main.
    expect(ecran.brouillon!.generation).toMatchObject({ issue: { ok: false, meilleure: { valide: false } } });
    expect(ecran.brouillon!.generation!.proposition?.texte).toContain("Bonjour à tous");
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("Sa meilleure version est gardée ci-dessous");
    expect(html).toContain("Bonjour à tous, vous avez essayé l&#x27;IA.");
    expect(html).toContain("Corriger à la main");
    expect(html).toContain("Réécrire");
    // Défauts éliminatoires restants : pas d'« Utiliser quand même ».
    expect(html).not.toContain("Utiliser quand même");
    const echappe = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    for (const m of motifs) expect(html).toContain(echappe(m));
  });
});

describe("l'écran : deux chemins", () => {
  it("d'abord le choix : « J'ai déjà mon texte » ou « Écrire le script pour moi »", async () => {
    const ecran = await creation.ecranCreationTableau();
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    expect(html).toContain("J&#x27;ai déjà mon texte");
    expect(html).toContain("Écrire le script pour moi");
    expect(html).not.toContain("Découper en scènes");
    expect(cheminDeDepart(null)).toBeNull();
    // Coût de l'écriture annoncé (vu en euros, avant le clic) et liste des fins sans doublon.
    expect(ecran.ecriture.reseaux.map((r) => r.valeur)).toEqual(["courts", "fil", "linkedin", "youtube"]);
    expect(new Set(ecran.fins.map((f) => f.ecran)).size).toBe(ecran.fins.length);
    expect(ecran.fins.find((f) => f.id === "fin-if-mot-envoi")).toMatchObject({ avecMot: true, validee: true });
  });

  it("après une écriture : les cinq accroches, la retenue en avant, le script par moment, la note, les points à préparer", async () => {
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await ecrireEtAttendre(DEMANDE, { accord: await prix() }, client);
    if (r.statut !== "terminee") throw new Error("non écrit");
    const ecran = await creation.ecranCreationTableau(r.videoId);
    expect(cheminDeDepart(ecran.brouillon)).toBe("ecrire");
    const html = renderToStaticMarkup(createElement(NouvelleVideoTableau, { ecran }));
    for (const a of ANGLE.accroches) expect(html).toContain(a.dit.replace(/'/g, "&#x27;"));
    expect(html).toContain("Retenue");
    expect(html.match(/Choisir et réécrire/g)).toHaveLength(4);
    for (const moment of ["Accroche", "Douleur", "Promesse", "Étapes", "Exemple", "À retenir", "Appel"]) expect(html).toContain(moment);
    expect(html).not.toContain("Récapitulatif");
    expect(html).toMatch(/Note : \d+ sur 10/);
    expect(html).toContain("À préparer avant de publier");
    expect(html).toContain("Utiliser ce script");
    expect(html).toMatch(/au plus\)/);
  });
});

/* ------------------------------------------------------------------ */
/* Fabrication : sorties, mot, trace                                     */
/* ------------------------------------------------------------------ */

const fiche = ficheErreurCorrigee;
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
const appelerDecoupage: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f: FicheTableau = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  // Style des nouvelles fiches (« reference/2 », 14/10) : la fiche rendue avec son gabarit de page clair.
  auStyleDemande(f);
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

describe("fabrication : réseaux → sorties, mot et trace transmis jusqu'à la fin", () => {
  beforeEach(async () => {
    const { texteScript: _s, ...regles } = contexteExemple(fiche);
    void _s;
    for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
    for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
  });

  it("les entrées de la vidéo portent les sorties dédoublonnées, le mot et la trace ; les raccords posent la fin de chaque sortie", async () => {
    const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-mot-envoi", mot: "guide", reseaux: ["verticaux", "linkedin", "verticaux"] };
    const p = await creation.decouperScriptTableau(donnees, { relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (p.statut !== "accord-requis") throw new Error(JSON.stringify(p));
    const d = await creation.decouperScriptTableau(donnees, { accord: p.centimes, relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (d.statut !== "en-cours") throw new Error(JSON.stringify(d));
    await creation.travaillerTachesTableau({ appeler: appelerDecoupage, aujourdhui: AUJOURDHUI_EXEMPLES });
    // Une trace de script rattachée au brouillon (comme après « Utiliser ce script »).
    const video = (await depots().videos.obtenir(d.videoId))!;
    const b = creation.lireBrouillonTableau(video)!;
    await depots().videos.modifier(d.videoId, { entrees: { ...video.entrees, tableauCreation: { ...b, generation: { traceId: "tst-essai", demande: DEMANDE_MODELE, le: "2026-10-11T00:00:00.000Z", issue: { ok: false, motifs: [] } } } } });
    const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined, lancer: async () => ({ travailId: "trav-essai" }) };
    await creation.cocherDejaVuTableau(d.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const prixVoix = await creation.fabriquerVideoTableau(d.videoId, undefined, deps, await relu(d.videoId));
    if (prixVoix.statut !== "accord-requis") throw new Error("prix attendu");
    // Le prix ne dépend pas du nombre de formats : une seule voix.
    expect(prixVoix.centimes).toBe((await creation.ecranCreationTableau(d.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES })).brouillon!.coutVoixCentimes);
    expect(await creation.fabriquerVideoTableau(d.videoId, prixVoix.centimes, deps, await relu(d.videoId))).toMatchObject({ statut: "lancee" });
    const apres = (await depots().videos.obtenir(d.videoId))!;
    const tableau = (apres.entrees as { tableau: Record<string, unknown> }).tableau;
    expect(tableau).toMatchObject({ sorties: ["vertical", "vertical-liens", "portrait-linkedin"], mot: "GUIDE", traceScriptId: "tst-essai" });

    // Les raccords du studio : fin de chaque sortie avec le mot, trace écrite en base par la fabrication.
    await import("@/services/tableau-branchements");
    process.env.STUDIO_COMMIT = "c0ffee1";
    const outils = await servicesTableau().outils!({ videoId: d.videoId, distribution: [{ role: "voix", source: "double", personnageId: "williams" }], entrees: apres.entrees, reseaux: [] } as never, "trav-essai");
    delete process.env.STUDIO_COMMIT;
    const dit = "Écrivez GUIDE en commentaire. Je vous l'envoie.";
    expect(outils!.choisirFin!("fin-if-mot-envoi", "vertical")).toEqual({ id: "fin-if-mot-envoi", ecran: "Écrivez GUIDE en commentaire", dit, type: "commentaire", mot: "GUIDE" });
    // LinkedIn (14/10) : aucun appel à commenter n'est dit dans la vidéo ; le carré se termine sans appel.
    expect(outils!.choisirFin!("fin-if-mot-envoi", "carre")).toEqual({ absente: expect.stringMatching(/^Aucun appel à commenter n'est dit dans une vidéo LinkedIn/) });
    // T5 : le portrait de LinkedIn, sa sortie depuis la décision 1 du 18/10, pareil.
    expect(outils!.choisirFin!("fin-if-mot-envoi", "portrait-linkedin")).toEqual({ absente: expect.stringMatching(/^Aucun appel à commenter n'est dit dans une vidéo LinkedIn/) });
    // TikTok et Shorts (12/10) : jamais la fin au mot ; aucune fin validée pour eux : sans appel, avec l'alerte.
    expect(outils!.choisirFin!("fin-if-mot-envoi", "vertical-liens")).toEqual({ absente: expect.stringMatching(/^Fin sans appel pour TikTok et Shorts : phrase à valider/) });
    expect(outils!.versionCode).toBe("c0ffee1");
    await outils!.tracer!({ videoId: d.videoId, type: "code", cle: "code:essai", date: "2026-10-11T09:00:00.000Z", ordre: 1, donnees: { commit: "c0ffee1" } });
    // Code de version (14/10) : posé par `codeVariante` à la construction des outils de la fabrication, un par réseau servi.
    const traces = await depots().tracesTableau.lister((e) => e.videoId === d.videoId);
    expect(traces).toEqual(expect.arrayContaining([expect.objectContaining({ origine: "fabrication", type: "code", donnees: { commit: "c0ffee1" } })]));
    const version = traces.find((e) => e.cle.startsWith("version:"));
    const codes = (version?.donnees as { codesVersion: Record<string, string> }).codesVersion;
    expect(Object.keys(codes)).toEqual(["instagram", "facebook", "tiktok", "youtube-shorts", "linkedin"]);
    const numero = codes.instagram.slice(0, 4);
    expect(codes).toEqual({ instagram: `${numero}-TB-IG`, facebook: `${numero}-TB-FB`, tiktok: `${numero}-TB-TT`, "youtube-shorts": `${numero}-TB-YS`, linkedin: `${numero}-TB-LI` });
    expect(numero).toMatch(/^\d{4}$/);
  });
});

describe("page de la vidéo et navigation mobile", () => {
  it("une vidéo par format, avec les réseaux qu'elle sert et un bouton de téléchargement", () => {
    const sorties = sortiesDeLaVersion(
      [
        { ratio: "1:1", fichierId: "f-carre", resolution: "1080x1080" },
        { ratio: "9:16", fichierId: "f-vertical", resolution: "1080x1920" },
      ],
      { "f-vertical": "https://r2.exemple/v.mp4", "f-carre": "https://r2.exemple/c.mp4" },
    );
    expect(sorties.map((s) => s.libelle)).toEqual(["Vertical 9:16", "Carré 1:1"]);
    expect(sorties[1].reseaux).toContain("LinkedIn");
    const html = renderToStaticMarkup(createElement(SortiesTableau, { sorties }));
    expect(html.match(/Télécharger/g)).toHaveLength(2);
    expect(html).toContain('href="https://r2.exemple/c.mp4"');
    expect(html).toContain("TikTok");
  });

  it("deux verticaux (12/10) : chaque fichier avec ses réseaux exacts, l'alerte de la fin sans appel sous celui de TikTok", () => {
    const alerte = "Fin sans appel pour TikTok et Shorts : phrase à valider (« Le lien est dans mon profil. »).";
    const projet = [
      { format: "vertical", libelle: "Vertical 9:16 · Reels et stories", ratio: "9:16", largeur: 1080, hauteur: 1920, reseaux: ["Reels Instagram", "Reels Facebook", "Stories Instagram et Facebook"], dureeSec: 61.2 },
      { format: "vertical-liens", libelle: "Vertical 9:16 · TikTok et Shorts", ratio: "9:16", largeur: 1080, hauteur: 1920, reseaux: ["TikTok", "YouTube Shorts"], dureeSec: 58.4 },
    ];
    const sorties = sortiesDeLaVersion(
      [
        { ratio: "9:16", fichierId: "f-liens", resolution: "1080x1920", dureeSec: 58.4, rapportQualite: { alertes: [{ code: "fin", message: alerte }] } },
        { ratio: "9:16", fichierId: "f-reels", resolution: "1080x1920", dureeSec: 61.2, rapportQualite: { alertes: [] } },
      ],
      { "f-liens": "https://r2.exemple/l.mp4", "f-reels": "https://r2.exemple/r.mp4" },
      projet,
    );
    expect(sorties.map((s) => [s.libelle, s.reseaux.join(", "), s.url, s.alertes ?? []])).toEqual([
      ["Vertical 9:16 · Reels et stories", "Reels Instagram, Reels Facebook, Stories Instagram et Facebook", "https://r2.exemple/r.mp4", []],
      ["Vertical 9:16 · TikTok et Shorts", "TikTok, YouTube Shorts", "https://r2.exemple/l.mp4", [alerte]],
    ]);
    const html = renderToStaticMarkup(createElement(SortiesTableau, { sorties }));
    expect(html.match(/Télécharger/g)).toHaveLength(2);
    expect(html).toContain("phrase à valider");
  });

  it("« Nouvelle vidéo » mène au tableau par le registre (plus de tuile mobile à part)", () => {
    expect(adresseCreationFormat({ id: "tableau-anime" })).toBe("/tableau/nouvelle");
    expect(listerFormatsNavigation().map((f) => f.id)).toContain("tableau-anime");
  });
});
