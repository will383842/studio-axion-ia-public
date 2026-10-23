/**
 * R2 — TEXTES DE PUBLICATION ÉCRITS PAR CLAUDE, PAR LE CHEMIN DE DÉPENSE CONTRÔLÉ (plan « outils réels » du 03/10, C9).
 * Sans clé ni réseau : Claude répond par un faux `fetch` (réponses enregistrées à la main, `tests/helpers/g0.ts`).
 * Tests ROUGES du plan (rouges sur 03d297b) : « obtenirKit avec Claude choisi : zéro appel » ; « suites de
 * fabrication : seuls les réseaux par défaut ».
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const pub = await import("@/services/publications");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import type { IdReseau, Video } from "@/domaine/types";

const MDP = "essai-r2-textes";
const PAR_DEFAUT: IdReseau[] = ["linkedin", "instagram", "tiktok", "youtube-shorts"];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  // CORRECTEUR FINAL A : la vidéo copiée de la démo sort du vrai moteur (une vidéo d'essai ne fait jamais écrire Claude).
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  // Claude CHOISI pour les textes de publication (Réglages > Connexions, ou FOURNISSEUR_TEXTE_RESEAUX=claude).
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

/** Réseau demandé par une requête Claude (lu dans la partie variable). */
function reseauDe(corps: Record<string, unknown>): string | undefined {
  const messages = corps.messages as { content: string }[] | undefined;
  return /<reseau id="([^"]+)"/.exec(messages?.[0]?.content ?? "")?.[1];
}

/** Claude répond un texte de publication valide pour le réseau demandé ; chaque requête est gardée. */
async function brancherClaude(options: { texte?: (reseau: string) => string; delaiMs?: number; sansRecharge?: boolean } = {}) {
  // Crédit Claude suivi : 5 $ déclarés (sauf essai du pré-vol).
  if (!options.sansRecharge) await credits.declarerRecharge("anthropic", 500);
  const appels: { reseau?: string; corps: Record<string, unknown> }[] = [];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    const reseau = reseauDe(corps);
    appels.push({ reseau, corps });
    if (options.delaiMs) await new Promise((r) => setTimeout(r, options.delaiMs));
    const texte = options.texte?.(reseau ?? "") ?? `Ce que coûtent vraiment les outils d'équipe.\n\nLe point en une minute, sans jargon.`;
    const titres = reseau?.startsWith("youtube") ? ["Télétravail : quels outils pour l'équipe ?"] : undefined;
    const sortie = { premiereLigne: texte.split("\n")[0], texte, motsDiese: ["#PME", "#Teletravail"], ...(titres ? { titres } : {}), justifications: [] };
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

/** Une vraie vidéo prête, SANS kit (copie de la démo v-04, hors exemples). */
async function videoSansKit(id = "v-r2"): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id, estDemo: false, titre: "Télétravail : quels outils pour l'équipe ?" };
  await depots().videos.enregistrer(v);
  expect(await depots().kits.trouver((k) => k.videoId === id)).toBeFalsy();
  return v;
}

describe("R2 · tests ROUGES du plan", () => {
  it("obtenirKit avec Claude choisi : zéro appel (l'affichage ne dépense jamais)", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    const kit = await pub.obtenirKit(v.id);
    expect(kit).not.toBeNull();
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.compter((r) => r.fournisseur === "anthropic")).toBe(0);
    // Un second affichage non plus.
    await pub.obtenirKit(v.id);
    expect(appels).toHaveLength(0);
  });

  it("suites de fabrication : Claude écrit SEULEMENT les réseaux par défaut, un appel chacun", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes: true }]);
    expect(appels.map((a) => a.reseau).sort()).toEqual([...PAR_DEFAUT].sort());
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    for (const r of PAR_DEFAUT) expect(kit.textes[r]?.source).toBe("claude");
    for (const r of ["facebook", "youtube"] as const) expect(kit.textes[r]?.source).not.toBe("claude");
  });
});

/* ------------------------------------------------------------------ */
/* Dépense, plafonds, verrou                                           */
/* ------------------------------------------------------------------ */

const { reponseErreur } = await import("./helpers/g0");
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { OrigineTexte, libelleReecrire } = await import("@/components/publication/KitPublication");
const dcv = await import("@/services/depense-claude-video");

async function depensesClaude(videoId: string) {
  return (await depots().depenses.lister((d) => d.videoId === videoId)).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));
}
async function journal(): Promise<string[]> {
  return (await depots().evenements.lister()).map((e) => e.message);
}
/** Suite « finition » de la PREMIÈRE fabrication (la seule où Claude écrit tout seul). */
const suite = (v: Video) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes: true }]);

describe("R2 · dépense rattachée à la vidéo", () => {
  it("chaque texte écrit : une dépense « anthropic » réelle sur la vidéo, la réservation consommée, l'étape nommée", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    await suite(v);
    const deps = await depensesClaude(v.id);
    expect(deps).toHaveLength(4);
    for (const d of deps) expect(d.lignes[0]).toMatchObject({ fournisseur: "anthropic", nature: "reel" });
    expect(deps.map((d) => d.lignes[0].etape).sort()).toEqual(["Texte de publication · Instagram", "Texte de publication · LinkedIn", "Texte de publication · TikTok", "Texte de publication · YouTube Shorts"]);
    const res = await depots().reservations.lister((r) => r.videoId === v.id);
    expect(res).toHaveLength(4);
    expect(res.every((r) => r.statut === "consommee" && r.fournisseur === "anthropic")).toBe(true);
    expect(await depots().generations.compter()).toBe(0);
  });

  it("une seconde suite (retouche, nouvelle fabrication) ne repaie rien : les textes de Claude sont gardés", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await suite(v);
    await suite(v);
    expect(appels).toHaveLength(4);
  });

  it("plafond PAR VIDÉO : au-delà, rien ne part ; les autres textes restent des textes d'essai", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    // 1er appel : 5 centimes réservés (pire cas × 1,2) ≤ 6. Ensuite : 2 centimes dépensés (1 centime d'euro, compté
    // au centime de dollar supérieur) + 5 réservés > 6 → rien d'autre ne part.
    await ecrireParametre("claude.plafondKitUsd", 0.06);
    await suite(v);
    expect(appels.map((a) => a.reseau)).toEqual(["linkedin"]);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBeLessThanOrEqual(6);
    const kit = (await pub.obtenirKit(v.id))!;
    expect(kit.reseaux.filter((r) => r.origine === "claude").map((r) => r.reseau)).toEqual(["linkedin"]);
    expect(kit.reseaux.find((r) => r.reseau === "tiktok")!.origine).toBe("essai");
    expect((await journal()).some((m) => /plafond de la vidéo atteint \(0,05\s€\)/.test(m))).toBe(true);
  });

  it("plafond par vidéo SOUS VERROU : deux appels lancés au même instant ne passent pas ensemble au-delà du plafond", async () => {
    const appels = await brancherClaude({ delaiMs: 40 });
    const v = await videoSansKit();
    await ecrireParametre("claude.plafondKitUsd", 0.06); // une seule réservation au pire cas (5 centimes)
    const { donneesPublication, entreePublication, rolePublication } = await import("@/generateur/roles/publication");
    const entree = (reseau: IdReseau) => entreePublication(donneesPublication({ reseau, titre: v.titre, texteValide: "Les outils de l'équipe.", adresse: "vous", mention: "", credits: [], regles: [] }));
    const r = await Promise.all((["linkedin", "tiktok", "instagram"] as const).map((x) => dcv.executerRolePourVideo(v.id, rolePublication, entree(x), { etape: x })));
    expect(appels).toHaveLength(1);
    expect(r.filter((x) => x.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.ok).map((x) => !x.ok && x.arret)).toEqual(["plafond-video", "plafond-video"]);
  });

  it("deux « Réécrire » simultanés : un seul passe sous un plafond d'un appel", async () => {
    const appels = await brancherClaude({ delaiMs: 40 });
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    await ecrireParametre("claude.plafondKitUsd", 0.06);
    const r = await Promise.allSettled([pub.regenererTexteKit(v.id, "linkedin"), pub.regenererTexteKit(v.id, "tiktok")]);
    expect(appels).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected").map((x) => (x as PromiseRejectedResult).reason.message)).toEqual([expect.stringMatching(/Plafond des textes de cette vidéo atteint/)]);
  });

  it("limite Claude du MOIS atteinte : aucun appel, aucune réservation", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await ecrireParametre("claude.plafondMensuelUsd", 0);
    await suite(v);
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.compter((r) => r.videoId === v.id)).toBe(0);
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "TEXTE_NON_ECRIT", message: expect.stringMatching(/Limite Claude du mois atteinte/) });
  });

  it("pré-vol : crédit Claude suivi insuffisant → aucun appel", async () => {
    const appels = await brancherClaude({ sansRecharge: true });
    await credits.declarerRecharge("anthropic", 1);
    const v = await videoSansKit();
    await suite(v);
    expect(appels).toHaveLength(0);
  });

  it("Claude refuse pour facturation : réservation rendue, aucune dépense, le texte d'essai reste", async () => {
    await credits.declarerRecharge("anthropic", 500);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => reponseErreur(400, "invalid_request_error", "Your credit balance is too low")) as typeof fetch, attenteMs: () => 0 });
    const v = await videoSansKit();
    await suite(v);
    expect(await depensesClaude(v.id)).toHaveLength(0);
    expect((await depots().reservations.lister((r) => r.videoId === v.id)).map((r) => r.statut)).toEqual(["liberee"]);
    expect((await pub.obtenirKit(v.id))!.reseaux.every((r) => r.origine === "essai")).toBe(true);
  });

  it("coupure après l'envoi : la clé n'apparaît nulle part, l'estimation RESTE comptée pour la vidéo (perte plafonnée)", async () => {
    await credits.declarerRecharge("anthropic", 500);
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      fetch: (async () => {
        throw new Error(`socket fermé (clé ${CLE_ESSAI_CLAUDE})`);
      }) as typeof fetch,
      attenteMs: () => 0,
    });
    const v = await videoSansKit();
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "TEXTE_NON_ECRIT" });
    expect((await journal()).join("\n")).not.toContain("ESSAI_cle_secrete");
    expect(await depots().reservations.compter((r) => r.videoId === v.id && r.statut === "active")).toBe(1);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* Rien d'inventé, retouches jamais écrasées, gestes de Will            */
/* ------------------------------------------------------------------ */

describe("R2 · rien d'inventé, la fin ajoutée par le code", () => {
  it("un nombre inventé est refusé : UNE reprise ciblée (corrections demandées), puis le bon texte", async () => {
    let n = 0;
    const appels = await brancherClaude({ texte: () => (++n === 1 ? "Ce que coûtent les outils d'équipe.\n\n87 % des PME perdent 6 heures par semaine." : "Ce que coûtent vraiment les outils d'équipe.\n\nLe point, sans jargon.") });
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    await pub.regenererTexteKit(v.id, "linkedin");
    expect(appels).toHaveLength(2);
    expect(JSON.stringify(appels[1].corps)).toContain("corrections_demandees");
    expect(JSON.stringify(appels[1].corps)).toContain("PUB-01");
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    expect(kit.textes.linkedin?.texte).not.toMatch(/87|6 heures/);
    expect(kit.textes.linkedin?.source).toBe("claude");
    expect(await depensesClaude(v.id)).toHaveLength(2); // les deux appels sont payés et comptés
  });

  it("deux réponses inventées : le texte actuel est gardé, Will est prévenu", async () => {
    const appels = await brancherClaude({ texte: () => "Un de nos clients a gagné 12 heures." });
    const v = await videoSansKit();
    const avant = (await pub.obtenirKit(v.id))!.reseaux.find((r) => r.reseau === "linkedin")!.texte;
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "TEXTE_NON_ECRIT", message: "Claude n'a pas écrit un texte utilisable : le texte actuel est gardé." });
    expect(appels).toHaveLength(rolePub.ESSAIS_TEXTE_PUBLICATION);
    expect((await pub.obtenirKit(v.id))!.reseaux.find((r) => r.reseau === "linkedin")!.texte).toBe(avant);
  });

  it("la mention de la vidéo (si activée) et les crédits sont ajoutés par le code, exactement comme réglés", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    await depots().videos.modifier(v.id, { mentionIA: { ...v.mentionIA, dansLegende: true, texte: "Réalisé avec l'IA" } });
    await suite(v);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    expect(kit.textes.linkedin?.texte.endsWith("\n\nRéalisé avec l'IA.")).toBe(true);
    // Mention coupée : rien n'est ajouté.
    const w = await videoSansKit("v-r2-b");
    await depots().videos.modifier(w.id, { mentionIA: { ...w.mentionIA, dansLegende: false } });
    await suite(w);
    expect((await depots().kits.trouver((k) => k.videoId === w.id))!.textes.linkedin?.texte).toBe("Ce que coûtent vraiment les outils d'équipe.\n\nLe point en une minute, sans jargon.");
  });
});

describe("R2 · un texte retouché à la main n'est JAMAIS écrasé", () => {
  it("retouché avant la suite : Claude ne l'écrit pas (3 appels), la retouche reste", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    await pub.modifierTexteKit(v.id, "linkedin", "Mon texte à moi.", ["#moi"]);
    await suite(v);
    expect(appels.map((a) => a.reseau)).not.toContain("linkedin");
    expect(appels).toHaveLength(3);
    const k = (await pub.obtenirKit(v.id))!.reseaux.find((r) => r.reseau === "linkedin")!;
    expect(k).toMatchObject({ texte: "Mon texte à moi.", origine: "main" });
  });

  it("retouche ANCIENNE (sans drapeau, d'avant R2) : jamais remplacée non plus", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    const kit = await pub.genererKit(v.id);
    await depots().kits.modifier(kit.id, { textes: { ...kit.textes, instagram: { texte: "Retouche d'avant.", motsDiese: [] } } });
    await suite(v);
    expect(appels.map((a) => a.reseau)).not.toContain("instagram");
    expect((await depots().kits.obtenir(kit.id))!.textes.instagram?.texte).toBe("Retouche d'avant.");
  });

  it("retouché PENDANT que Claude écrit : la retouche de Will gagne", async () => {
    const appels = await brancherClaude({ delaiMs: 60 });
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    const enCours = suite(v);
    while (appels.length < 1) await new Promise((r) => setTimeout(r, 5));
    await pub.modifierTexteKit(v.id, "linkedin", "Écrit pendant ce temps.", []);
    await enCours;
    const k = (await depots().kits.trouver((x) => x.videoId === v.id))!;
    expect(k.textes.linkedin).toMatchObject({ texte: "Écrit pendant ce temps.", modifieAMain: true });
    expect((await journal()).some((m) => /retouché pendant l'écriture, votre version est gardée/.test(m))).toBe(true);
  });

  it("« Réécrire » sur un texte retouché demande confirmation (aucun appel), puis remplace", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    await pub.modifierTexteKit(v.id, "tiktok", "À moi.", []);
    await expect(pub.regenererTexteKit(v.id, "tiktok")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(appels).toHaveLength(0);
    await pub.regenererTexteKit(v.id, "tiktok", { remplacerRetouche: true });
    expect(appels).toHaveLength(1);
    expect((await pub.obtenirKit(v.id))!.reseaux.find((r) => r.reseau === "tiktok")!.origine).toBe("claude");
  });
});

describe("R2 · quand Claude n'écrit pas", () => {
  it("Claude non choisi : suites et « Réécrire » restent la simulation, 0 appel, aucun prix affiché", async () => {
    const appels = await brancherClaude();
    await ecrireParametre("fournisseur.texte-reseaux", null);
    const v = await videoSansKit();
    await suite(v);
    await pub.regenererTexteKit(v.id, "linkedin");
    expect(appels).toHaveLength(0);
    const kit = (await pub.obtenirKit(v.id))!;
    expect(kit.reseaux.every((r) => r.origine === "essai" && !r.prixReecriture)).toBe(true);
  });

  it("Claude choisi SANS clé : 0 appel", async () => {
    gc.injecterClaudePourEssai(null);
    const v = await videoSansKit();
    await suite(v);
    expect(await depots().reservations.compter((r) => r.videoId === v.id)).toBe(0);
  });

  it("vidéo de version (texte déjà écrit par le générateur) et vidéo d'exemple : 0 appel", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await depots().videos.modifier(v.id, { varianteId: "var-inconnue" });
    await suite(v);
    await suite((await depots().videos.obtenir("v-04"))!);
    expect(appels).toHaveLength(0);
  });

  it("Claude choisi : l'affichage montre le prix de « Réécrire » et l'origine de chaque texte", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    await suite(v);
    const kit = (await pub.obtenirKit(v.id))!;
    const li = kit.reseaux.find((r) => r.reseau === "linkedin")!;
    const fb = kit.reseaux.find((r) => r.reseau === "facebook")!;
    expect(li.origine).toBe("claude");
    expect(fb.origine).toBe("essai");
    expect(li.prixReecriture?.centimes).toBeGreaterThan(0);
    expect(li.prixReecriture?.centimes).toBeLessThanOrEqual(10);
  });
});

describe("R2 · écran du kit (rendu)", () => {
  it("origine en clair, prix dit avant le geste, aucune mention imposée", () => {
    const html = (o: Parameters<typeof OrigineTexte>[0]["origine"]) => renderToStaticMarkup(createElement(OrigineTexte, { origine: o }));
    expect(html("claude")).toContain("Écrit par Claude");
    expect(html("essai")).toContain("Texte d&#x27;essai");
    expect(html("main")).toContain("Retouché par vous");
    expect(html(undefined)).toBe("");
    expect(libelleReecrire({ prixReecriture: { centimes: 7, devise: "EUR" } })).toMatch(/^Réécrire · jusqu'à environ 0,07\s€$/);
    expect(libelleReecrire({})).toBe("Réécrire");
    for (const o of ["claude", "essai", "main", "version"] as const) expect(html(o)).not.toMatch(/\bIA\b/);
  });
});

/* ------------------------------------------------------------------ */
/* Relecture du lot R2 (exactitude, simplicité, sécurité)              */
/* ------------------------------------------------------------------ */

const fabrication = await import("@/services/fabrication");
const { pireCasRole } = await import("@/generateur/roles/types");
const rolePub = await import("@/generateur/roles/publication");

/** Une suite « finition » après une RETOUCHE ou un recalque (pas la première fabrication). */
const suiteRetouche = (v: Video) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0] }]);

/** Claude qui compte ses appels et répond toujours la même erreur de facturation. */
function brancherFacturation() {
  let n = 0;
  gc.injecterClaudePourEssai({
    cle: CLE_ESSAI_CLAUDE,
    fetch: (async () => {
      n++;
      return reponseErreur(400, "invalid_request_error", "Your credit balance is too low");
    }) as typeof fetch,
    attenteMs: () => 0,
  });
  return () => n;
}

describe("R2 relecture n° 1 · l'écriture automatique ne part qu'UNE fois par vidéo", () => {
  it("refus de facturation, puis une seconde suite : AUCUN nouvel appel (seul « Réécrire » relance)", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const appels = brancherFacturation();
    const v = await videoSansKit();
    await suite(v);
    expect(appels()).toBe(1);
    await suite(v);
    await suiteRetouche(v);
    expect(appels()).toBe(1);
  });

  it("deux sorties refusées sur chaque réseau, puis une seconde suite : aucun nouvel appel", async () => {
    const appels = await brancherClaude({ texte: () => "Un de nos clients a gagné 12 heures." });
    const v = await videoSansKit();
    await suite(v);
    const apres = appels.length;
    expect(apres).toBe(PAR_DEFAUT.length * rolePub.ESSAIS_TEXTE_PUBLICATION);
    await suite(v);
    expect(appels).toHaveLength(apres);
  });

  it("une retouche après la première écriture : aucun appel, même sur un réseau resté en texte d'essai", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await ecrireParametre("claude.plafondKitUsd", 0.06); // un seul texte écrit
    await suite(v);
    expect(appels).toHaveLength(1);
    await ecrireParametre("claude.plafondKitUsd", 0.3);
    await suiteRetouche(v);
    expect(appels).toHaveLength(1);
  });

  it("une retouche d'une vidéo dont le kit n'a jamais été écrit par Claude (vidéo d'avant R2) : aucun appel", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    await suiteRetouche(v);
    expect(appels).toHaveLength(0);
  });
});

describe("R2 relecture n° 2 · le journal du studio se lit sans code", () => {
  it("refus, marqueur d'arrêt, repli de modèle : aucun code d'évaluation, marqueur brut, expression ni identifiant de modèle", async () => {
    await credits.declarerRecharge("anthropic", 500);
    let n = 0;
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      attenteMs: () => 0,
      fetch: (async () => {
        n++;
        const texte =
          n <= 2
            ? JSON.stringify({ premiereLigne: "x", texte: "Un de nos clients a gagné 12 heures. Le levier caché.", motsDiese: ["PME"], justifications: [] })
            : n === 3
              ? JSON.stringify({ premiereLigne: "PREUVE_MANQUANTE", texte: "PREUVE_MANQUANTE", motsDiese: [], justifications: [] })
              : JSON.stringify({ premiereLigne: "Ce que coûtent les outils.", texte: "Ce que coûtent les outils.\n\nLe point.", motsDiese: ["PME", "#a b"], justifications: [{ texte: "x", regleId: "inventee" }] });
        return reponseFlux(fluxReussi({ texte, modele: "claude-haiku-4-5", repliDe: "claude-sonnet-5-5" }));
      }) as typeof fetch,
    });
    const v = await videoSansKit();
    await suite(v);
    const j = (await journal()).join("\n");
    expect(j).toMatch(/refusé/);
    expect(j).not.toMatch(/PUB-\d/);
    expect(j).not.toMatch(/ANCRAGE_MANQUANT|PREUVE_MANQUANTE/);
    expect(j).not.toMatch(/claude-(opus|sonnet|haiku)/);
    expect(j).not.toMatch(/\\b|\(\?|\[\^|\\p\{/);
  });
});

describe("R2 relecture n° 3 · mots-dièse", () => {
  it("un mot-dièse qui cache un lien est refusé par l'évaluation et jamais posé dans le kit", async () => {
    const d = rolePub.donneesPublication({ reseau: "linkedin", titre: "Outils", texteValide: "Les outils de l'équipe.", adresse: "vous", mention: "", credits: [], regles: [] });
    const s = { premiereLigne: "Les outils.", texte: "Les outils.", motsDiese: ["#www.site.com"], justifications: [] };
    expect(rolePub.evaluerPublication(s, d, { critiques: true }).length).toBeGreaterThan(0);
    expect(rolePub.motsDiesePropres("linkedin", ["#www.site.com", "#PME", "#a-b"])).toEqual(["#PME"]);
  });
});

describe("R2 relecture n° 4 · « Réécrire » refusé là où il serait payé pour rien", () => {
  it("sur le réseau d'une vidéo de version : refusé, aucun appel", async () => {
    const appels = await brancherClaude();
    const v = await videoSansKit();
    const le = new Date().toISOString();
    await depots().variantes.enregistrer({ id: "var-r2", code: "0099-AV-TT", scriptMaitreId: "suj-r2", reseau: "tiktok", version: 1, publication: { texte: "Texte de la version.", motsDiese: [], justifications: [] }, creeLe: le, modifieLe: le } as never);
    await depots().videos.modifier(v.id, { varianteId: "var-r2" });
    await expect(pub.regenererTexteKit(v.id, "tiktok")).rejects.toMatchObject({ code: "TEXTE_DE_VERSION" });
    expect(appels).toHaveLength(0);
  });

  it("sur une vidéo d'exemple avec Claude choisi : refusé, aucun appel", async () => {
    const appels = await brancherClaude();
    await expect(pub.regenererTexteKit("v-04", "linkedin")).rejects.toMatchObject({ code: "VIDEO_EXEMPLE" });
    expect(appels).toHaveLength(0);
  });
});

describe("R2 relecture n° 6 · appel interrompu d'un mois précédent", () => {
  it("soldé avec une dépense estimée : le plafond de la vidéo en tient toujours compte", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    const ancien = "2026-08-15T10:00:00.000Z";
    await depots().reservations.enregistrer({ id: "res-ancienne", fournisseur: "anthropic", videoId: v.id, travailId: "txtpub-ancien", centimes: 5, devise: "USD", statut: "active", creeLe: ancien, modifieLe: ancien });
    await pub.regenererTexteKit(v.id, "linkedin");
    expect((await depots().reservations.obtenir("res-ancienne"))?.statut).toBe("consommee");
    // 5 centimes de l'appel interrompu + le nouvel appel (≥ 1 centime).
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBeGreaterThanOrEqual(6);
  });
});

describe("R2 relecture n° 7 · le prix des textes est annoncé au lancement de la fabrication", () => {
  it("Claude choisi : une ligne « Textes des réseaux » comptée dans le total ; sinon, aucune", async () => {
    await brancherClaude();
    const v = (await depots().videos.obtenir("v-07"))!;
    await depots().videos.modifier(v.id, { estDemo: false });
    // CORRECTEUR FINAL A : au moteur d'essai (défaut), aucune ligne Claude (une vidéo d'essai ne fait pas écrire Claude).
    expect((await fabrication.apercuFabrication(v.id)).estimation.lignes.some((l) => l.etape === "Textes des réseaux")).toBe(false);
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const avec = await fabrication.apercuFabrication(v.id);
    const ligne = avec.estimation.lignes.find((l) => l.etape === "Textes des réseaux");
    expect(ligne).toMatchObject({ fournisseur: "anthropic", nature: "estime" });
    expect(ligne!.total.centimes).toBeGreaterThan(0);
    expect(avec.textesReseaux).toEqual(ligne!.total);
    await ecrireParametre("fournisseur.texte-reseaux", null);
    const sans = await fabrication.apercuFabrication(v.id);
    expect(sans.estimation.lignes.some((l) => l.etape === "Textes des réseaux")).toBe(false);
    expect(avec.estimation.total.centimes - sans.estimation.total.centimes).toBe(ligne!.total.centimes);
    // Écran : la ligne se lit dans le bloc du coût, en euros.
    const { LigneTextesReseaux } = await import("@/assistant/etapes/Apercu");
    const html = renderToStaticMarkup(createElement(LigneTextesReseaux, { montant: ligne!.total }));
    expect(html).toContain("Textes des réseaux");
    expect(html).toMatch(/environ \d+,\d{2}\s€/);
  });

  it("la suite d'une fabrication lancée avec cette ligne écrit bien les textes ; une seconde fabrication ne l'annonce plus", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    expect(await pub.ligneTextesDesReseaux(v.id)).not.toBeNull();
    await suite(v);
    expect(await pub.ligneTextesDesReseaux(v.id)).toBeNull();
  });
});

describe("R2 relecture n° 8 · une seule monnaie à l'écran", () => {
  it("le plafond de la vidéo est dit en euros", async () => {
    await brancherClaude();
    const v = await videoSansKit();
    await pub.obtenirKit(v.id);
    await ecrireParametre("claude.plafondKitUsd", 0.01);
    const e = await pub.regenererTexteKit(v.id, "linkedin").catch((x: Error) => x);
    expect((e as Error).message).toMatch(/€/);
    expect((e as Error).message).not.toMatch(/\$/);
    expect((await journal()).filter((m) => /plafond/i.test(m)).join("\n")).not.toMatch(/\$/);
  });
});

/* ------------------------------------------------------------------ */
/* 2ᵉ relecture (exactitude, simplicité)                               */
/* ------------------------------------------------------------------ */

const couts = await import("@/services/couts");
const { TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");

describe("R2 2ᵉ relecture (a) · les textes des réseaux ne bloquent JAMAIS la vidéo", () => {
  /** Vidéo prête à fabriquer, hors exemples, Claude choisi pour les textes mais SANS crédit Claude. */
  async function videoAFabriquer() {
    await brancherClaude({ sansRecharge: true });
    await credits.declarerRecharge("anthropic", 1); // 1 centime de dollar : bien trop peu
    const v = (await depots().videos.obtenir("v-07"))!;
    await depots().videos.modifier(v.id, { estDemo: false });
    // CORRECTEUR FINAL A : une vidéo d'essai (moteur de simulation) n'annonce plus de textes Claude ; ici, le format
    // part au vrai moteur (réglage en base), comme une vraie vidéo.
    await ecrireParametre("moteur.avocat", "montage-avocat");
    return v;
  }

  it("crédit Claude absent : la fabrication part quand même ; le montant prévu est engagé sur le budget", async () => {
    const v = await videoAFabriquer();
    const apercu = await fabrication.apercuFabrication(v.id);
    expect(apercu.textesReseaux?.centimes).toBeGreaterThan(0);
    const { travailId } = await fabrication.lancerFabrication(v.id, { confirme: true });
    expect(travailId).toBeTruthy();
    // Aucune réservation Claude au lancement (le chemin des textes réserve lui-même, appel par appel).
    expect(await depots().reservations.compter((r) => r.travailId === travailId && r.fournisseur === "anthropic")).toBe(0);
    // Le budget annoncé (textes compris) est bien engagé.
    expect((await couts.resumeBudget()).engage.centimes).toBe(apercu.estimation.total.centimes);
  });

  it("budget juste suffisant pour la vidéo seule : elle part quand même, sans confirmation de plus", async () => {
    const v = await videoAFabriquer();
    const apercu = await fabrication.apercuFabrication(v.id);
    const videoSeule = apercu.estimation.total.centimes - apercu.textesReseaux!.centimes;
    await ecrireParametre("budget.mensuel", { centimes: videoSeule, devise: "EUR" });
    await ecrireParametre("budget.seuilConfirmation", { centimes: videoSeule, devise: "EUR" });
    const apres = await fabrication.apercuFabrication(v.id);
    expect(apres.budget.depasse).toBe(false);
    expect(apres.budget.confirmationRequise).toBe(false);
    await expect(fabrication.lancerFabrication(v.id)).resolves.toMatchObject({ travailId: expect.any(String) });
  });

  it("à la fin, sans crédit Claude : aucun appel, les textes restent en version d'essai", async () => {
    const appels = await brancherClaude({ sansRecharge: true });
    await credits.declarerRecharge("anthropic", 1);
    const v = await videoSansKit();
    await suite(v);
    expect(appels).toHaveLength(0);
    expect((await pub.obtenirKit(v.id))!.reseaux.every((r) => r.origine === "essai")).toBe(true);
  });
});

describe("R2 relecture n° 5 et 2ᵉ relecture (b) · un seul nombre d'essais, prix au pire cas", () => {
  it("réponses toujours refusées : autant d'appels que d'essais ; le journal et le prix « jusqu'à environ » suivent la même constante", async () => {
    const N = rolePub.ESSAIS_TEXTE_PUBLICATION;
    expect(N).toBeGreaterThanOrEqual(1);
    const appels = await brancherClaude({ texte: () => "Un de nos clients a gagné 12 heures." });
    const v = await videoSansKit();
    const li = (await pub.obtenirKit(v.id))!.reseaux.find((r) => r.reseau === "linkedin")!;
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "TEXTE_NON_ECRIT" });
    expect(appels).toHaveLength(N);
    expect((await journal()).some((m) => m.includes(`essai ${N} sur ${N}`))).toBe(true);
    const e = rolePub.entreePublication(rolePub.donneesPublication({ reseau: "linkedin", titre: v.titre, texteValide: "x", adresse: "vous", mention: "", credits: [], regles: [] }));
    expect(li.prixReecriture!.centimes).toBeGreaterThanOrEqual(Math.floor(N * pireCasRole(rolePub.rolePublication, e) * 100 * TAUX_USD_EUR_PAR_DEFAUT));
    expect(libelleReecrire(li)).toMatch(/^Réécrire · jusqu'à environ \d+,\d{2}\s€$/);
  });
});

describe("R2 2ᵉ relecture (c) · la ligne des textes dit qu'elle est comprise dans le total", () => {
  it("« Textes des réseaux · environ X € (compris dans le total) »", async () => {
    const { LigneTextesReseaux } = await import("@/assistant/etapes/Apercu");
    const html = renderToStaticMarkup(createElement(LigneTextesReseaux, { montant: { centimes: 5, devise: "EUR" } }));
    const texte = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(texte).toMatch(/^Textes des réseaux environ 0,05\s€ \(compris dans le total\)$/);
  });
});

describe("R2 · vidéo supprimée définitivement pendant l'écriture des textes (relecture PR #334)", () => {
  it("le retour de Claude n'écrit rien, plus aucun appel, aucun kit ni événement recréé", async () => {
    const { executerSuppression } = await import("@/services/suppression-video");
    const v = await videoSansKit();
    await brancherClaude();
    // Le premier appel part, la vidéo est supprimée avant son retour.
    const appels: unknown[] = [];
    gc.injecterClaudePourEssai({
      cle: CLE_ESSAI_CLAUDE,
      attenteMs: () => 0,
      fetch: (async () => {
        appels.push(1);
        const video = await depots().videos.obtenir(v.id);
        if (video) await executerSuppression(video);
        const sortie = { premiereLigne: "Ligne.", texte: "Ligne.\n\nSuite.", motsDiese: ["#PME"], justifications: [] };
        return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
      }) as typeof fetch,
    });
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes: true }]);
    expect(await depots().videos.obtenir(v.id)).toBeNull();
    expect(appels).toHaveLength(1);
    expect(await depots().kits.compter((k) => k.videoId === v.id)).toBe(0);
    expect(await depots().evenements.compter((e) => e.entiteId === v.id && e.type !== "video_supprimee")).toBe(0);
    expect(journal).not.toHaveBeenCalled();
    journal.mockRestore();
  });
});
