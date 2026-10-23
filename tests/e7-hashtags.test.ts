/**
 * ÉQUIPE 7 · TIKTOK — FAMILLE DE MOTS-DIÈSE FIXE ET TERMES D'IA (docs/conception/TIKTOK-SERIES-HASHTAGS.md, § 2.1-2.2).
 * Le générateur et Claude piochent UNIQUEMENT dans « Vos hashtags » ; #fyp, #viral, #pourtoi, #foryou sont retirés par
 * le CODE après Claude. « Intelligence artificielle », « IA », « ChatGPT » : dits avant 5 s (TikTok) et écrits dans
 * la description. Aucun appel réseau, aucune clé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import {
  choisirDansFamille,
  estInterdit,
  famillePour,
  HASHTAGS_PAR_DEFAUT,
  HASHTAGS_TIKTOK_PAR_DEFAUT,
  validerFamille,
} from "@/reseaux/hashtags";
import { ecritureReseau } from "@/reseaux/ecriture";
import { donneesPublication, entreePublication, evaluerPublication, finaliserPublication, type SortiePublication } from "@/generateur/roles/publication";
import { avecTermeDuCompte, contientTermeDuCompte } from "@/domaine/textes-publication";
import { fournisseurTexteReseauxSimulation } from "@/fournisseurs/simulation/autres";
import { c10 } from "@/domaine/controles-script/structure";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const hashtags = await import("@/services/hashtags");
const reglages = await import("@/services/reglages");

const MDP = "essai-e7-hashtags";
const TITRE = "Vos devis en 10 minutes";
const SCRIPT = "Vos devis vous prennent une heure. Avec l'intelligence artificielle, dix minutes suffisent. Voici comment.";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("Famille de mots-dièse (PUR)", () => {
  it("TikTok est prérempli avec la famille de Will ; les autres réseaux restent libres", () => {
    expect(HASHTAGS_TIKTOK_PAR_DEFAUT).toEqual(["#IA", "#intelligenceartificielle", "#IAentreprise", "#ChatGPT", "#formationIA"]);
    expect(famillePour("tiktok", HASHTAGS_PAR_DEFAUT)).toEqual(HASHTAGS_TIKTOK_PAR_DEFAUT);
    expect(famillePour("linkedin", HASHTAGS_PAR_DEFAUT)).toBeNull();
    expect(famillePour("instagram", { instagram: [] })).toBeNull();
  });

  it("TikTok : 3 à 5 mots-dièse", () => {
    expect(ecritureReseau("tiktok").motsDiese.valeur).toEqual([3, 5]);
  });

  it("liste interdite : #fyp, #viral, #pourtoi, #foryou et leurs variantes, quelle que soit la graphie", () => {
    for (const m of ["#fyp", "#FYP", "fyp", "#fypシ", "#fypage", "#viral", "#Viral", "#viralvideo", "#pourtoi", "#PourToi", "#pourtoii", "#foryou", "#ForYouPage", "#foryoupage", "#fy"]) expect(estInterdit(m), m).toBe(true);
    for (const m of ["#IA", "#ChatGPT", "#formationIA", "#PME", "#automatisation"]) expect(estInterdit(m), m).toBe(false);
  });

  it("choisirDansFamille : garde ceux de la famille (graphie de la famille), complète jusqu'au minimum, coupe au maximum", () => {
    const famille = HASHTAGS_TIKTOK_PAR_DEFAUT;
    expect(choisirDansFamille(["#chatgpt", "#PME", "#fyp"], famille, [3, 5])).toEqual(["#ChatGPT", "#IA", "#intelligenceartificielle"]);
    expect(choisirDansFamille(["#formationia", "#ia", "#IAentreprise", "#ChatGPT", "#intelligenceartificielle", "#IA"], famille, [3, 5])).toEqual(["#formationIA", "#IA", "#IAentreprise", "#ChatGPT", "#intelligenceartificielle"]);
    expect(choisirDansFamille([], famille, [3, 4])).toHaveLength(3);
    // Sans famille : seulement les interdits retirés (et les doublons).
    expect(choisirDansFamille(["#PME", "#viral", "#pme", "#Devis"], null, [0, 3])).toEqual(["#PME", "#Devis"]);
  });

  it("validerFamille : refuse un interdit, une forme illisible, moins de 3 pour TikTok ; nettoie la saisie", () => {
    expect(validerFamille("tiktok", ["IA", " #ChatGPT ", "#formationIA", "#IA"])).toEqual({ ok: true, liste: ["#IA", "#ChatGPT", "#formationIA"] });
    const interdit = validerFamille("tiktok", ["#IA", "#ChatGPT", "#fyp"]);
    expect(interdit.ok).toBe(false);
    if (!interdit.ok) expect(interdit.message).toContain("#fyp");
    expect(validerFamille("tiktok", ["#IA", "#ChatGPT"]).ok).toBe(false);
    expect(validerFamille("tiktok", ["#IA", "#Chat GPT!", "#x"]).ok).toBe(false);
    expect(validerFamille("linkedin", [])).toEqual({ ok: true, liste: [] });
  });
});

describe("Textes de publication : la famille appliquée PAR LE CODE après Claude", () => {
  const donnees = (famille: readonly string[] | null) => donneesPublication({ reseau: "tiktok", titre: TITRE, texteValide: SCRIPT, formatId: "avocat", dureeSec: 30, mention: "", credits: [], regles: [], famille });
  const sortie = (s: Partial<SortiePublication>): SortiePublication => ({ premiereLigne: "Vos devis en 10 minutes", texte: "Vos devis en 10 minutes\nAvec l'intelligence artificielle.", motsDiese: ["#fyp", "#viral", "#PME", "#ChatGPT"], justifications: [], ...s });

  it("Claude donne #fyp #viral #PME : seuls des mots-dièse de la famille partent (3 à 5)", () => {
    const fini = finaliserPublication(sortie({}), { reseau: "tiktok", titreVideo: TITRE, mention: "", credits: [], famille: HASHTAGS_TIKTOK_PAR_DEFAUT });
    expect(fini.motsDiese.length).toBeGreaterThanOrEqual(3);
    expect(fini.motsDiese.length).toBeLessThanOrEqual(5);
    for (const m of fini.motsDiese) expect(HASHTAGS_TIKTOK_PAR_DEFAUT).toContain(m);
    expect(fini.motsDiese[0]).toBe("#ChatGPT");
  });

  it("un interdit n'arrive jamais, même sans famille (autre réseau)", () => {
    const fini = finaliserPublication(sortie({ motsDiese: ["#foryou", "#PME", "#pourtoi"] }), { reseau: "instagram", titreVideo: TITRE, mention: "", credits: [] });
    expect(fini.motsDiese).toEqual(["#PME"]);
  });

  it("la consigne de Claude liste la famille et nomme les interdits", () => {
    const v = entreePublication(donnees(HASHTAGS_TIKTOK_PAR_DEFAUT)).variable;
    expect(v).toContain("#IA #intelligenceartificielle #IAentreprise #ChatGPT #formationIA");
    expect(v).toMatch(/jamais #fyp/i);
  });

  it("l'évaluation signale un mot-dièse hors famille (le code le corrige ensuite)", () => {
    const echecs = evaluerPublication(sortie({ motsDiese: ["#PME", "#IA", "#ChatGPT"] }), donnees(HASHTAGS_TIKTOK_PAR_DEFAUT));
    expect(echecs.some((e) => e.includes("#PME"))).toBe(true);
  });

  it("description TikTok : un terme d'IA écrit en toutes lettres, ajouté par le code s'il manque", () => {
    expect(contientTermeDuCompte("Vos devis en 10 minutes avec ChatGPT")).toBe(true);
    expect(contientTermeDuCompte("L'IA fait vos devis")).toBe(true);
    expect(contientTermeDuCompte("Vos devis en 10 minutes")).toBe(false);
    expect(contientTermeDuCompte("Le PIAF de la maison")).toBe(false);
    const ajoute = avecTermeDuCompte("Vos devis en 10 minutes", "tiktok");
    expect(contientTermeDuCompte(ajoute)).toBe(true);
    expect(ajoute.startsWith("Vos devis en 10 minutes")).toBe(true);
    // Rien n'est ajouté ailleurs que sur TikTok, ni quand le terme est déjà là.
    expect(avecTermeDuCompte("Vos devis en 10 minutes", "linkedin")).toBe("Vos devis en 10 minutes");
    expect(avecTermeDuCompte("Vos devis avec l'IA", "tiktok")).toBe("Vos devis avec l'IA");
    const fini = finaliserPublication(sortie({ premiereLigne: "Vos devis en 10 minutes", texte: "Vos devis en 10 minutes\nLe point en une minute." }), { reseau: "tiktok", titreVideo: TITRE, mention: "", credits: [], famille: HASHTAGS_TIKTOK_PAR_DEFAUT });
    expect(contientTermeDuCompte(fini.texte)).toBe(true);
  });

  it("le texte d'essai TikTok (simulé) dit aussi un terme d'IA", async () => {
    const t = await fournisseurTexteReseauxSimulation.ecrire({ reseau: "tiktok", titre: "Relancer un devis par SMS", texteScript: "Vous envoyez un devis, puis plus rien.", mentionIA: "", credits: [], formatId: "avocat", dureeSec: 30, adresse: "vous" });
    expect(contientTermeDuCompte(t.texte)).toBe(true);
  });
});

describe("Générateur : TikTok dit un terme d'IA avant 5 s (C10 quater, corrigé à l'étape 12)", () => {
  const reseau = parametresGenerateur("avocat").reseau("tiktok");
  const analyse = (dit: string) => ({ marge: 1, segments: [{ index: 0, texte: dit, dit, debutSec: 0, finSec: 3, role: "accroche", marqueurs: [] }] });
  function violations(dit: string): string[] {
    const sortie: string[] = [];
    const col = { ajouter: (id: string, m: string) => sortie.push(`${id} : ${m}`) };
    c10({ auteur: "machine", motCle: "devis", motCleSource: "hypothese", reseau } as never, analyse(dit) as never, col as never);
    return sortie;
  }
  it("les termes du compte sont des données du réseau TikTok", () => {
    expect(ecritureReseau("tiktok").termesDuCompte?.valeur).toEqual(expect.arrayContaining(["intelligence artificielle", "IA en entreprise", "ChatGPT"]));
    expect(reseau.termesDuCompte?.length).toBeGreaterThan(0);
    expect(parametresGenerateur("avocat").reseau("linkedin").termesDuCompte).toBeUndefined();
  });
  it("sans terme d'IA avant 5 s : violation ; avec : rien de plus", () => {
    expect(violations("Vos devis, vos devis prennent une heure.").some((v) => v.startsWith("C10 quater") && v.includes("intelligence artificielle"))).toBe(true);
    expect(violations("Vos devis avec l'IA : vos devis prennent une heure.").some((v) => v.includes("intelligence artificielle"))).toBe(false);
  });
});

describe("Réglages › Mes réseaux › Vos hashtags (service)", () => {
  it("lecture : TikTok prérempli par défaut", async () => {
    expect((await hashtags.lireFamilles()).tiktok).toEqual(HASHTAGS_TIKTOK_PAR_DEFAUT);
    expect((await reglages.lireReglages()).hashtags.tiktok).toEqual(HASHTAGS_TIKTOK_PAR_DEFAUT);
  });
  it("écriture : nettoyée, gardée ; un interdit est refusé avec une phrase claire", async () => {
    await hashtags.definirFamille("tiktok", ["IA", "#ChatGPT", "#automatisation"]);
    expect((await hashtags.lireFamilles()).tiktok).toEqual(["#IA", "#ChatGPT", "#automatisation"]);
    await expect(hashtags.definirFamille("tiktok", ["#IA", "#ChatGPT", "#pourtoi"])).rejects.toThrow(/#pourtoi/);
  });
});

describe("Kit de publication : textes d'essai, retouche, envoi", () => {
  async function videoPrete(id = "v-e7") {
    const modele = (await depots().videos.obtenir("v-15"))!;
    await depots().videos.enregistrer({ ...modele, id, estDemo: false });
    return id;
  }

  it("le texte d'essai TikTok du kit pioche dans la famille", async () => {
    const id = await videoPrete();
    const kit = (await pub.obtenirKit(id))!;
    const tt = kit.reseaux.find((r) => r.reseau === "tiktok")!;
    expect(tt.motsDiese.length).toBeGreaterThanOrEqual(3);
    for (const m of tt.motsDiese) expect(HASHTAGS_TIKTOK_PAR_DEFAUT).toContain(m);
  });

  it("une retouche à la main avec #fyp est refusée", async () => {
    const id = await videoPrete();
    await expect(pub.modifierTexteKit(id, "tiktok", "Mon texte sur l'IA", ["#IA", "#fyp", "#ChatGPT"])).rejects.toThrow(/#fyp/);
  });

  it("à l'envoi, un interdit déjà présent dans un ancien kit ne part pas", async () => {
    const id = await videoPrete();
    await pub.obtenirKit(id);
    const kit = (await depots().kits.trouver((k) => k.videoId === id))!;
    await depots().kits.modifier(kit.id, { textes: { ...kit.textes, instagram: { texte: "Texte ancien", motsDiese: ["#PME", "#viral"], modifieAMain: true } } });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
    const r = await pub.envoyerVersBuffer(id, ["instagram"], new Date(Date.now() + 86_400_000).toISOString());
    expect(r.publications[0].texte).toContain("#PME");
    expect(r.publications[0].texte).not.toContain("#viral");
  });
});
