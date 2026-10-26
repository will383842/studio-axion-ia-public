/**
 * L16 · Onglet « Image → vidéo » (5 écrans). Tout est SIMULÉ : la machine du lot L15 tourne sur les doubles de
 * `doubles-fabrication.ts` (aucun appel payant, aucune date, aucun hasard) ; les écrans sont rendus en HTML statique.
 * Couvre : rendu des 5 écrans, refus < 800 px, carte corrigée puis validée, script modifié (question, accroche, version
 * prudente) validé par la machine, prix sur le bouton avant toute dépense, verdict par réseau, aucun identifiant
 * technique à l'écran, dépôt refusé sans accord ni format raccordé, format toujours masqué du menu.
 */
import { VERSION_MESURE_VOIX } from "@/briques/voix-maitre/reference";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { cleFormule, verifierScript } = await import("@/moteurs/montage-image-video/regles");
const { ficheSimulee } = await import("@/moteurs/montage-image-video/ecriture.simulation");
const { avecVersionsPrudentes } = await import("@/domaine/image-video/versions-prudentes");
const { CLE_LANCEUR_IV } = await import("@/moteurs/montage-image-video");
const { avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV } = await import("@/moteurs/montage-image-video/fabrication");
const vue = await import("@/components/formats/image-video/vue");
const ecran = await import("@/services/image-video-ecran");
const { Depot } = await import("@/components/formats/image-video/Depot");
const { CarteComprise } = await import("@/components/formats/image-video/CarteComprise");
const { ScriptEcrans } = await import("@/components/formats/image-video/ScriptEcrans");
const { Fabrication } = await import("@/components/formats/image-video/Fabrication");
const { VosVideos } = await import("@/components/formats/image-video/VosVideos");
const { formatImageVideo } = await import("@/formats/image-video");

type Etat = Awaited<ReturnType<typeof avancerJusquAArretIV>>;

/** Texte lu à l'écran (balises retirées). */
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Identifiants internes qui ne doivent jamais être lus par Will. */
const TECHNIQUE = /\b(carte-a-valider|script-a-valider|mise-en-scene|youtube-shorts|tableau-de-bord|avant-apres|debut-reponse|carte-benefice|IV_[A-Z_]+|e\d{2}|n\d{2}|l\d{2}|c\d{2}|undefined|null|NaN)\b/;

function travailDe(etat: Etat, statut: Travail["statut"], erreur?: Travail["erreur"]): Travail {
  return { id: "trav-1", type: "fabrication", cibleId: "v-1", versionId: "ver-1", titre: "Essai", etapes: [], statut, progression: 0, tentatives: 1, cleIdempotence: "k", creeLe: "2026-10-15T08:00:00.000Z", modifieLe: "2026-10-15T08:00:00.000Z", parametres: { imageVideo: etat }, ...(erreur ? { erreur } : {}) } as unknown as Travail;
}
const VIDEO = { id: "v-1", titre: "Chatbot 24h/24" };

async function jusquALaCarte(nom: Parameters<typeof carteFixe>[0]) {
  const carte = carteFixe(nom);
  const m = monde();
  const o = outilsSimules(carte, m);
  return { carte, m, o, e: await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o) };
}

describe("L16 · écran 1 « Déposer »", () => {
  it("refuse clairement une image de moins de 800 px de côté, et un fichier qui n'est pas une image", () => {
    expect(vue.refusDimensions(600, 1200)).toBe("Image trop petite (600 × 1200 px). Il faut 800 px de côté au moins.");
    expect(vue.refusDimensions(800, 1600)).toBeNull();
    expect(vue.refusDimensions(0, 0)).toMatch(/ne s'ouvre pas/);
    expect(vue.refusFichier({ type: "image/gif", size: 10 })).toMatch(/PNG, JPEG ou WebP/);
    expect(vue.refusFichier({ type: "image/webp", size: 10 })).toBeNull();
  });

  it("montre la zone de dépôt, les 4 réseaux, l'offre et le prix SUR le bouton", () => {
    const montants = { 1: 120, 2: 180, 3: 240, 4: 300 };
    const html = texte(renderToStaticMarkup(createElement(Depot, { montants })));
    expect(html).toContain("Déposez une ou plusieurs images");
    expect(html).toContain("800 px de côté au moins");
    for (const r of ["YouTube Shorts", "LinkedIn", "Instagram", "Facebook"]) expect(html).toContain(r);
    expect(html).toContain("Selon l'image");
    expect(html).toMatch(/Fabriquer la vidéo \(au plus 3,00\s?€\)/);
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("le prix du dépôt est celui que le moteur réserve, et grandit avec les réseaux", () => {
    const cinq = ecran.prixDuDepot(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    const un = ecran.prixDuDepot(["linkedin"]);
    expect(cinq).toBeGreaterThan(un);
    expect(un).toBeGreaterThan(0);
  });
});

describe("L16 · dépôt avec doubles (rien n'est créé tant qu'un refus est possible)", () => {
  const fichier = async () => ({ id: "f-1", cleStockage: "studio/dev/entree/image-video/f-1.png", mime: "image/png", nom: "chatbot-24h.png", sha256: "abc", taille: 2_000_000 });
  const voix = async () => ({ voixId: "voix-1", personnageId: "moi" });

  it("image trop lourde côté serveur (même limite que le navigateur) : refus avant tout brouillon", async () => {
    const brouillon = vi.fn();
    const lourde = async () => ({ ...(await fichier()), taille: vue.TAILLE_MAX_IMAGE_OCTETS + 1 });
    const r = await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["linkedin"], largeur: 1080, hauteur: 1350, accordCentimes: 10_000 }, { formatOuvert: () => true, voix, fichier: lourde, brouillon });
    expect(r).toEqual({ statut: "refusee", phrase: vue.PHRASE_IMAGE_TROP_LOURDE });
    expect(brouillon).not.toHaveBeenCalled();
  });

  it("une vidéo d'un autre format (ou sans format) n'ouvre pas ces écrans", async () => {
    const travail = vi.fn(async () => null);
    expect(await ecran.vueImageVideo("v-1", { video: async () => ({ ...VIDEO, formatId: "" }), travail })).toBeNull();
    expect(await ecran.vueImageVideo("v-1", { video: async () => ({ ...VIDEO, formatId: "cas-concret" }), travail })).toBeNull();
    expect(travail).not.toHaveBeenCalled();
  });

  it("format pas encore raccordé : une phrase, aucun brouillon", async () => {
    const brouillon = vi.fn();
    const r = await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["linkedin"], largeur: 1080, hauteur: 1350, accordCentimes: 10_000 }, { formatOuvert: () => false, voix, fichier, brouillon });
    expect(r).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.pasRaccorde });
    expect(brouillon).not.toHaveBeenCalled();
  });

  it("image trop petite ou aucun réseau : refus avant tout", async () => {
    const brouillon = vi.fn();
    expect((await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["linkedin"], largeur: 640, hauteur: 900 }, { formatOuvert: () => true, voix, fichier, brouillon })).statut).toBe("refusee");
    expect(await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: [], largeur: 1080, hauteur: 1350 }, { formatOuvert: () => true, voix, fichier, brouillon })).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.sansReseau });
    expect(brouillon).not.toHaveBeenCalled();
  });

  it("sans accord (ou accord plus bas que le prix) : le prix est redemandé, rien n'est créé", async () => {
    const brouillon = vi.fn();
    const dep = { formatOuvert: () => true, voix, fichier, brouillon, taux: async () => 0.92 };
    const sans = await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["youtube-shorts", "linkedin"], largeur: 1080, hauteur: 1350 }, dep);
    expect(sans.statut).toBe("accord-requis");
    const bas = await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["youtube-shorts", "linkedin"], largeur: 1080, hauteur: 1350, accordCentimes: 1 }, dep);
    expect(bas.statut).toBe("accord-requis");
    expect(brouillon).not.toHaveBeenCalled();
  });

  it("avec l'accord du prix affiché : brouillon du format masqué puis lancement commun, offre corrigée gardée", async () => {
    const brouillon = vi.fn(async () => ({ id: "v-9" }));
    const lancer = vi.fn(async () => ({ statut: "lancee" as const, travailId: "trav-9" }));
    const montant = ecran.prixDuDepot(["youtube-shorts", "linkedin"], 0.92);
    const r = await ecran.deposerImageVideo(
      { fichierId: "f-1", reseaux: ["linkedin", "youtube-shorts", "inconnu"], offre: "audit", largeur: 1080, hauteur: 1350, accordCentimes: montant },
      { formatOuvert: () => true, voix, fichier, brouillon, lancer, taux: async () => 0.92, accordEssai: async () => false },
    );
    expect(r).toEqual({ statut: "lancee", videoId: "v-9" });
    const e = (brouillon.mock.calls[0] as unknown as [{ titre: string; entrees: { imageVideo: Record<string, unknown> } }])[0];
    expect(e.titre).toBe("chatbot 24h");
    expect(e.entrees.imageVideo).toMatchObject({ imageCle: "studio/dev/entree/image-video/f-1.png", reseaux: ["youtube-shorts", "linkedin"], offre: "audit", accordEssaiReel: false, largeur: 1080, hauteur: 1350 });
    expect(lancer).toHaveBeenCalledWith("v-9", montant, montant);
  });
});

describe("L16 · écran 2 « Ce que j'ai compris »", () => {
  it("la machine s'arrête sur la carte (10 premières) ; l'écran la montre en blocs, branches et chiffres", async () => {
    const { e } = await jusquALaCarte("C");
    expect(e.etape).toBe("carte-a-valider");
    const v = ecran.construireVueImageVideo(VIDEO, travailDe(e, "echec", { code: "IV_CARTE_A_VALIDER", reessayable: true, messagePourWill: "Vérifiez." }), "https://exemple/c.png");
    expect(v.ecran).toBe("carte");
    expect(v.barre).toBe("carte");
    expect(v.fabrication.refus).toBeUndefined();
    const html = texte(renderToStaticMarkup(createElement(CarteComprise, { videoId: "v-1", vue: v.carte!.vue, carte: v.carte!.carte, imageUrl: v.imageUrl })));
    expect(html).toMatch(/Image à embranchement · vidéo d'environ \d+ s/);
    expect(html).toContain("Valider la carte");
    expect(html).toContain("Corriger un texte");
    for (const n of e.propositionCarte!.carte.noeuds) expect(html).toContain(n.libelle.replace(/&/g, "&"));
    expect(v.carte!.vue.branches.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("les écarts entre les deux lectures sont surlignés ; les formules sont à trancher", async () => {
    const carte = carteFixe("F");
    const n = carte.noeuds[1];
    const avecEcart = { ...carte, lecture: { ...carte.lecture, ecarts: [{ champ: `noeuds.${n.id}`, lectureA: n.libelle, lectureB: "autre" }] } };
    const v = vue.vueDeLaCarte(avecEcart, ["1 écart(s) entre les deux lectures."]);
    const bloc = [...v.blocs, ...v.branches.flatMap((b) => b.blocs)].find((b) => b.id === n.id)!;
    expect(bloc.ecart).toBe(true);
    expect(v.formules.map((f) => f.texte)).toEqual(expect.arrayContaining(["Zéro erreur"]));
    const html = texte(renderToStaticMarkup(createElement(CarteComprise, { videoId: "v-1", vue: v, carte: avecEcart, imageUrl: null })));
    expect(html).toContain("À vérifier");
    expect(html).toContain("Version prudente");
    expect(html).toContain("Garder");
  });

  it("une carte corrigée à l'écran (texte, chiffre affiché seulement) est acceptée par la machine", async () => {
    const { e, o } = await jusquALaCarte("C");
    const p = e.propositionCarte!;
    const n = [...p.carte.noeuds].sort((a, b) => a.ordre - b.ordre)[0];
    const chiffre = p.carte.chiffres[0];
    const corrigee = vue.carteCorrigeeParWill(p.carte, { libelles: { [n.id]: `${n.libelle} (client)` }, aDire: chiffre ? { [chiffre.id]: false } : {}, formules: {} });
    expect(corrigee).toBeDefined();
    expect(vue.carteCorrigeeParWill(p.carte, vue.AUCUNE_CORRECTION)).toBeUndefined();
    const apres = validerCarteIV(e, { proposition: p.empreinte, carte: corrigee, le: "2026-10-15T08:00:00.000Z" });
    expect(apres.etape).toBe("ecriture");
    expect(apres.carte!.carte.noeuds.find((x) => x.id === n.id)).toMatchObject({ libelle: `${n.libelle} (client)`, ajoutWill: true });
    const suite = await avancerJusquAArretIV(apres, o);
    expect(suite.etape).toBe("script-a-valider");
  });
});

describe("L16 · écran 3 « Le script »", () => {
  async function jusquAuScript(nom: Parameters<typeof carteFixe>[0]) {
    const d = await jusquALaCarte(nom);
    const e = await avancerJusquAArretIV(validerCarteIV(d.e, { proposition: d.e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), d.o);
    return { ...d, e };
  }

  it("une ligne par écran, deux accroches, la question, le prix SUR le bouton avant toute voix", async () => {
    const { e, m } = await jusquAuScript("C");
    expect(e.etape).toBe("script-a-valider");
    expect(m.lus).toHaveLength(0);
    // 26/10/2026 : la question de commentaire n'est plus posée par défaut ; l'écran la montre seulement dans le réglage « question puis fin ».
    const parDefaut = ecran.construireVueImageVideo(VIDEO, travailDe(e, "echec"), null).script!;
    expect(texte(renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", ...parDefaut })))).not.toContain("La question pour faire commenter");
    const avecQuestion = { ...e, demande: { ...e.demande, appelCommentaire: "question-puis-fin" as const } };
    const v = ecran.construireVueImageVideo(VIDEO, travailDe(avecQuestion, "echec"), null);
    expect(v.ecran).toBe("script");
    const s = v.script!;
    expect(s.prix.auPlusCentimes).toBeGreaterThan(0);
    const html = texte(renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", ...s })));
    const auPlus = vue.euros(Math.max(s.prix.auPlusCentimes, s.prix.habituelCentimes));
    expect(html).toContain(`Valider et fabriquer (au plus ${auPlus})`);
    expect(html).toContain("Modifier le script");
    expect(html).toContain("La question pour faire commenter");
    expect(html).toContain(s.fiche.accroches[0].texteDit);
    expect(html).toContain(s.fiche.accroches[1].texteDit);
    for (const ec of s.fiche.ecrans) expect(html).toContain(ec.texteDit);
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("phrases trop affirmatives : surlignées, bouton bloqué tant que rien n'est tranché ; « version prudente » passe la machine", async () => {
    const { e, o } = await jusquAuScript("F");
    const p = e.propositionScript!;
    expect(p.formules.length).toBeGreaterThan(0);
    expect(vue.formulesNonTranchees(p.formules, vue.AUCUNE_MODIFICATION)).toHaveLength(p.formules.length);
    const html = renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", fiche: p.fiche, formules: p.formules, aTrancher: [], prix: p.prix, avecQuestion: true }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Valider et fabriquer/);
    // Les deux choix sont des boutons à bascule lisibles par un lecteur d'écran.
    expect(html.match(/aria-pressed="false"/g)?.length).toBeGreaterThanOrEqual(p.formules.length * 2);
    const lignes = vue.lignesDuScript(p.fiche, p.formules);
    expect(lignes.some((l) => l.aTrancher)).toBe(true);
    const choix = Object.fromEntries(p.formules.map((f) => [f.cle, "reformuler" as const]));
    const d = vue.scriptValideParWill(p.fiche, p.formules, { ecrans: {}, formules: choix });
    expect(d.choixFormules).toEqual(choix);
    // La version prudente est posée dans chaque texte où la formule est écrite (côté écran comme côté serveur).
    const prudente = ecran.avecVersionsPrudentes(p.fiche, d.choixFormules)!;
    expect(d.fiche).toEqual(prudente);
    expect(texte(renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", fiche: d.fiche!, formules: p.formules, aTrancher: [], prix: p.prix, avecQuestion: true })))).toContain("Presque plus d'erreurs");
    expect(prudente).not.toBeNull();
    expect(JSON.stringify(prudente.ecrans)).toContain("Presque plus d'erreurs");
    expect(JSON.stringify(prudente.ecrans).toLowerCase()).not.toContain("zéro erreur");
    expect(ecran.avecVersionsPrudentes(p.fiche, Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const])))).toBeNull();
    const apres = validerScriptIV(e, { proposition: p.empreinte, ...d, fiche: prudente });
    expect(apres.etape).toBe("voix");
    const fini = await avancerJusquAArretIV(apres, o);
    expect(["prete", "refusee"]).toContain(fini.etape);
  });

  it("« version prudente » posée UNE fois (jamais « presque presque toujours »), le script passe les contrôles, l'écran montre le vrai texte", async () => {
    const carte = carteFixe("C");
    const fiche = ficheSimulee("essai-c")!;
    const choix = { [cleFormule("0 demande perdue")]: "garder" as const, [cleFormule("toujours")]: "reformuler" as const };
    expect(JSON.stringify(fiche)).toContain("toujours");
    const prudente = avecVersionsPrudentes(fiche, choix)!;
    expect(prudente).not.toBeNull();
    const json = JSON.stringify(prudente);
    expect(json).toContain("presque toujours");
    expect(json).not.toMatch(/presque\s+presque/i);
    expect(json.match(/presque toujours/gi)?.length).toBe(JSON.stringify(fiche).match(/toujours/gi)?.length);
    // Un second passage ne change plus rien (idempotent).
    expect(avecVersionsPrudentes(prudente, choix)).toBeNull();
    const verdict = verifierScript(prudente, { carte, choixFormules: choix });
    expect(verdict.manquements).toEqual([]);
    expect(verdict.ok).toBe(true);
    // Les contrôles en direct ne signalent plus une erreur qui n'existe pas.
    const { controlerScriptIV } = await import("@/moteurs/montage-image-video/controle-script");
    const pastilles = controlerScriptIV(
      { etape: "script-a-valider", propositionScript: { fiche } as never, carte: { carte } as never, demande: {} as never, variete: undefined } as never,
      { fiche, choixFormules: choix },
    );
    expect(pastilles.filter((x) => x.code === "Q05bis")).toEqual([]);
  });

  it("ce que Will lit hors édition = ses modifications ET la version prudente (ligne modifiée à la main contenant « toujours »)", () => {
    const fiche = ficheSimulee("essai-c")!;
    const ecr = fiche.ecrans.find((e) => e.partie === "douleur")!;
    const formules = [{ cle: cleFormule("toujours"), texte: "toujours", proposition: "presque toujours", ecranId: ecr.id }] as never;
    const m = { ecrans: { [ecr.id]: { texteDit: "Votre client attend toujours une réponse." } }, formules: { [cleFormule("toujours")]: "reformuler" as const } };
    const d = vue.scriptValideParWill(fiche, formules, m);
    const lu = vue.lignesDuScript(d.fiche ?? fiche, formules).find((l) => l.id === ecr.id)!;
    expect(lu.texteDit).toBe("Votre client attend presque toujours une réponse.");
    expect(JSON.stringify(d.fiche)).not.toMatch(/presque\s+presque/i);
  });

  it("script modifié en place (question, texte dit) : seules les différences changent, la machine l'accepte", async () => {
    const { e } = await jusquAuScript("C");
    const p = e.propositionScript!;
    const garder = Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const]));
    const douleur = p.fiche.ecrans.find((x) => x.partie === "douleur")!;
    const d = vue.scriptValideParWill(p.fiche, p.formules, { ecrans: { [douleur.id]: { texteDit: "Vous, vous dormez. Lui, il patiente." } }, formules: garder, question: "Et chez vous, qui répond la nuit ?" });
    expect(d.fiche!.questionCommentaire.texteDit).toBe("Et chez vous, qui répond la nuit ?");
    expect(d.fiche!.ecrans.find((x) => x.id === douleur.id)!.texteDit).toBe("Vous, vous dormez. Lui, il patiente.");
    expect(d.ajoutsWill).toEqual(["Vous, vous dormez. Lui, il patiente."]);
    expect(d.fiche!.ecrans.filter((x) => x.id !== douleur.id)).toEqual(p.fiche.ecrans.filter((x) => x.id !== douleur.id));
    expect(vue.scriptValideParWill(p.fiche, p.formules, { ecrans: {}, formules: garder }).fiche).toBeUndefined();
    expect(validerScriptIV(e, { proposition: p.empreinte, ...d }).etape).toBe("voix");
  });

  it("l'autre accroche passe en premier écran ; si elle perd un chiffre de l'image, la machine le dit en une phrase", async () => {
    const { e } = await jusquAuScript("C");
    const p = e.propositionScript!;
    const garder = Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const]));
    const d = vue.scriptValideParWill(p.fiche, p.formules, { ecrans: {}, formules: garder, autreAccroche: true });
    expect(d.fiche!.accroches[0]).toEqual(p.fiche.accroches[1]);
    expect(d.fiche!.ecrans.find((x) => x.partie === "accroche")!.texteDit).toBe(p.fiche.accroches[1].texteDit);
    expect(() => validerScriptIV(e, { proposition: p.empreinte, ...d })).toThrow(/contrôles/);
  });
});

describe("L16 · écran 4 « Fabrication » et écran 5 « Vos vidéos »", () => {
  async function jusquAuBout(nom: Parameters<typeof carteFixe>[0]) {
    const d = await jusquALaCarte(nom);
    let e = await avancerJusquAArretIV(validerCarteIV(d.e, { proposition: d.e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), d.o);
    const p = e.propositionScript!;
    const pendant = validerScriptIV(e, { proposition: p.empreinte, choixFormules: Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const])) });
    e = await avancerJusquAArretIV(pendant, d.o);
    return { pendant, e };
  }

  it("avancement étape par étape avec la dépense, sans identifiant technique", async () => {
    const { pendant } = await jusquAuBout("C");
    const v = ecran.construireVueImageVideo(VIDEO, travailDe(pendant, "en_cours"), null);
    expect(v.ecran).toBe("fabrication");
    expect(v.barre).toBe("fabrication");
    expect(v.fabrication.pas.find((x) => x.cle === "voix")!.etat).toBe("en-cours");
    expect(v.fabrication.pas.filter((x) => x.etat === "fait").map((x) => x.cle)).toEqual(["lecture", "carte-a-valider", "ecriture", "script-a-valider"]);
    const html = texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: v.fabrication, enCours: true, ecran: v.ecran })));
    for (const n of ["Lecture de l'image", "La voix", "Le rendu", "Les vérifications", "Les versions par réseau", "Dépense", "plafond"]) expect(html).toContain(n);
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("fabrication en cours : « Arrêter » est proposé (avec le travail) ; hors cours ou sans travail : non", async () => {
    const { pendant } = await jusquAuBout("C");
    const v = ecran.construireVueImageVideo(VIDEO, travailDe(pendant, "en_cours"), null);
    expect(v.travailId).toBe("trav-1");
    const rendu = (enCours: boolean, arret?: typeof v.arret) => texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: v.fabrication, enCours, ecran: v.ecran, arret })));
    expect(v.arret?.travailId).toBe("trav-1");
    expect(rendu(true, v.arret)).toContain("Arrêter");
    expect(rendu(true, undefined)).not.toContain("Arrêter");
    expect(rendu(false, v.arret)).not.toContain("Arrêter");
    // Travail mené par le LANCEUR : il ne lit jamais l'annulation et continuerait de payer : aucun bouton « Arrêter ».
    const lanceur = { ...travailDe(pendant, "en_cours"), parametres: { imageVideo: pendant, [CLE_LANCEUR_IV]: true } } as unknown as Travail;
    expect(ecran.construireVueImageVideo(VIDEO, lanceur, null).arret).toBeUndefined();
    // Fabrication arrêtée : pas de carte « Besoin de plus de marge ? », un message clair et un lien vers les vidéos.
    const annule = ecran.construireVueImageVideo(VIDEO, travailDe(pendant, "annule"), null);
    expect(annule.arret).toBeUndefined();
    expect(annule.plafond).toBeUndefined();
    const html = texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: annule.fabrication, enCours: false, ecran: annule.ecran, arretee: annule.arretee, plafond: annule.plafond })));
    expect(html).toContain("Fabrication arrêtée");
    expect(html).not.toContain("Besoin de plus de marge");
  });

  it("« Arrêter » : la feuille annonce le total déjà payé (lecture et écriture comprises), pas seulement la voix", async () => {
    const { pendant } = await jusquAuBout("C");
    const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");
    const video = { id: "v-1", titre: "Essai", formatId: ID_FORMAT_IMAGE_VIDEO, entrees: {} };
    const travail = travailDe(pendant, "en_cours");
    const v = await ecran.vueImageVideo("v-1", { video: async () => video, travail: async () => travail, url: async () => null, relireScript: async () => false, depenses: async () => [{ centimes: 30, devise: "EUR" }, { centimes: 45, devise: "EUR" }] });
    expect(v?.arret?.depense.centimes).toBe(75);
  });

  it("un arrêt dit quoi en une phrase et propose « Refaire cette partie »", () => {
    const etat = { etape: "refusee", caisse: { plafondCentimes: 300, reservations: [{ cle: "a", etape: "lecture", fournisseur: "anthropic", centimes: 40 }] }, refus: { etape: "rendu", code: "IV_RENDU", message: "Le rendu n'a pas abouti.", reessayable: true } } as unknown as Etat;
    const f = vue.vueFabrication(etat);
    expect(f.pas.find((x) => x.cle === "rendu")!.etat).toBe("arrete");
    expect(f.engageCentimes).toBe(40);
    const html = texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: f, enCours: false, ecran: "fabrication" })));
    expect(html).toContain("Le rendu n'a pas abouti.");
    expect(html).toContain("Refaire cette partie");
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("15/10 · arrêt Q16 voix sur une mesure ancienne (v-dd3049053f88) : « Refaire cette partie » est proposé ; mesure à jour : non", () => {
    const rapport = (versionMesure?: number) => ({ prises: [{ empreinteDemande: "x#lecture-1", fichierCle: "b.mp3", coutCentimes: 30, caracteres: 60, mesure: null, ...(versionMesure ? { versionMesure } : {}), ressemblante: false, ecarts: ["part de parole -14 % (toléré 12 %)"] }], retenue: 0, ressemblante: false });
    const etatQ16 = (versionMesure?: number) =>
      ({
        etape: "refusee",
        caisse: { plafondCentimes: 300, reservations: [] },
        refus: { etape: "voix", code: "IV_VOIX", message: "La voix de la fin pour tiktok, youtube-shorts, instagram ne ressemble pas assez à la voix de référence (part de parole -14 % (toléré 12 %)).", reessayable: false },
        voix: { voix: { corps: { texte: "c", lectures: 1, retenu: true }, fins: [{ id: "f", texte: "t", lectures: 2, prise: { texte: "t", empreinte: "e", etat: { phase: "faite", audio: { ressemblance: rapport(versionMesure) } }, controle: { ok: true } } }], payees: [], reformulations: [], issue: { statut: "faite" } } },
      }) as unknown as Etat;
    const f = vue.vueFabrication(etatQ16());
    expect(f.refus?.reessayable).toBe(true);
    const html = texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: f, enCours: false, ecran: "fabrication" })));
    expect(html).toContain("Refaire cette partie");
    // 19/10 : une mesure de version 2 (brute) est désormais ancienne pour Image → vidéo ; seule la version courante ne se refait pas.
    expect(vue.vueFabrication(etatQ16(2)).refus?.reessayable).toBe(true);
    expect(vue.vueFabrication(etatQ16(VERSION_MESURE_VOIX)).refus?.reessayable).toBe(false);
  });

  it("lancement refusé par le moteur (format masqué) : la phrase du moteur, jamais son code", () => {
    const t = { ...travailDe({} as Etat, "echec", { code: "IV_FORMAT_MASQUE", reessayable: false, messagePourWill: "Le format « Image → vidéo » n'est pas encore ouvert : un essai réel demande l'accord de Will." }), parametres: {} } as Travail;
    const v = ecran.construireVueImageVideo(VIDEO, t, null);
    const html = texte(renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", vue: v.fabrication, enCours: false, ecran: v.ecran })));
    expect(html).toContain("pas encore ouvert");
    expect(html).not.toContain("Refaire cette partie");
    expect(html).not.toMatch(TECHNIQUE);
  });

  it("vidéos finies : une carte par réseau, verdict en une phrase, textes à copier, téléchargement", async () => {
    const { e } = await jusquAuBout("C");
    expect(e.etape).toBe("prete");
    const v = await ecran.vueImageVideo("v-1", { video: async () => ({ ...VIDEO, formatId: "image-video", entrees: { imageVideo: { imageCle: "studio/dev/entree/image-video/f-1.png" } } }), travail: async () => travailDe(e, "termine"), url: async (cle) => `https://exemple/${cle}` });
    expect(v!.ecran).toBe("videos");
    expect(v!.barre).toBe("videos");
    expect(v!.imageUrl).toBe("https://exemple/studio/dev/entree/image-video/f-1.png");
    const html = texte(renderToStaticMarkup(createElement(VosVideos, { videos: v!.videos!, verdict: v!.verdict })));
    for (const r of ["YouTube Shorts", "LinkedIn", "Instagram", "Facebook"]) expect(html).toContain(r);
    expect(html).toContain("Télécharger");
    expect(html).toContain("Copier le texte");
    expect(v!.videos!.every((x) => x.phrase.length > 0)).toBe(true);
    expect(html).not.toMatch(TECHNIQUE);
    expect(html).not.toMatch(/Brouillon Buffer|Programmer/);
  });

  it("mentions par réseau : « un peu longue » orange, « version courte » orange, non livré rouge", () => {
    const c = vue.cartesReseaux([
      { reseau: "facebook", version: "longue", dureeSec: 52 },
      { reseau: "tiktok", version: "longue", dureeSec: 66.2, mention: "un peu longue pour ce réseau" },
      { reseau: "linkedin", version: "courte", dureeSec: 58 },
      { reseau: "youtube-shorts", version: "aucune", mention: "Trop longue pour YouTube Shorts (74 s) : raccourcissez le script ou retirez ce réseau." },
    ]);
    expect(c.map((x) => [x.nom, x.ton])).toEqual([
      ["TikTok", "orange"],
      ["YouTube Shorts", "rouge"],
      ["LinkedIn", "orange"],
      ["Facebook", "vert"],
    ]);
    expect(c[0].phrase).toBe("Prête, un peu longue pour ce réseau.");
    expect(c[2].phrase).toBe("Version courte, prête à publier.");
    expect(c[0].duree).toBe("66 s");
  });
});

describe("L16 · le format reste masqué et rien de partagé n'est touché", () => {
  it("statut masqué ; aucun lien vers l'onglet en dehors du dossier du format (18/10 : plus d'entrée de menu, tout passe par Nouvelle vidéo)", () => {
    expect(formatImageVideo.statut).toBe("masque");
    const lister = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? lister(join(d, n)) : [join(d, n)]));
    const racine = join(process.cwd(), "src/components");
    const liens = lister(racine).filter((f) => !f.includes(join("formats", "image-video")) && /\.tsx?$/.test(f) && readFileSync(f, "utf8").includes('"/image-video'));
    expect(liens).toEqual([]);
  });

  it("aucun texte des écrans n'utilise de mode sombre", () => {
    const dossier = join(process.cwd(), "src/components/formats/image-video");
    for (const f of readdirSync(dossier)) expect(readFileSync(join(dossier, f), "utf8")).not.toMatch(/\bdark:/);
  });
});
