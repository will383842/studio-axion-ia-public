/**
 * VÉRIF V4 — ARGENT (10/10/2026). Règles de Will :
 *  - aucune dépense sans confirmation explicite, à chaque fois ;
 *  - le Décor IA est retiré : il ne part JAMAIS (même une carte déjà affichée en prod sur une ancienne vidéo) ;
 *  - interrupteur « Couper toutes les options payantes » : coupé = aucune carte payante proposée, rien ne part ;
 *  - une confirmation ne vaut que pour la version qu'elle a lancée (une autre version qui recopie le jeton : refusée) ;
 *  - relances, reprises après redémarrage : la confirmation déjà utilisée ne repaie rien ;
 *  - les « Tester » de Réglages et la veille ne font que des lectures gratuites.
 * Dépôts en mémoire, aucun réseau (fetch interdit), doubles « réels » espions.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** `lancerRetouche` remplacé : une nouvelle version (entrées données) et son travail, sans moteur. */
const retouches: { videoId: string; consigne: string; entrees?: Record<string, unknown> }[] = [];
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, _plans: string[], consigne: string, options: { entrees?: Record<string, unknown> } = {}) => {
      const { depots } = await import("@/donnees/memoire");
      const v = (await depots().videos.obtenir(videoId))!;
      const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
      const n = retouches.push({ videoId, consigne, entrees: options.entrees });
      const versionId = `ver-v4-${n}`;
      const travailId = `trav-v4-${n}`;
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 200 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "fabrication", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const op = await import("@/services/options-payantes");
const { discuterAvecMonteur } = await import("@/services/monteur-facecam");
const { passeDecorFacecam, PARAM_DECOR_IA } = await import("@/services/decor-ia");
const { definirDecorIaAction } = await import("@/app/(studio)/reglages/actions-decor");
const { definirOptionsPayantesCoupeesAction } = await import("@/app/(studio)/reglages/actions-options-payantes");
const { choisirFournisseurMulticamera } = await import("@/fournisseurs/multicamera");
const { higgsfieldPourOption } = await import("@/services/options-payantes-higgsfield");
const { gardeMulticamera } = await import("@/services/options-payantes-multicamera");
import type { DemandeConfirmation } from "@/briques/options-payantes";
import type { FournisseurHiggsfield } from "@/fournisseurs/higgsfield/types";
import type { FournisseurVisage } from "@/fournisseurs/types";

const MDP = "essai-verif-v4-argent";
const VIDEO = "v-04";
const ENV_REEL = { HIGGSFIELD_API_KEY: "cle-secrete-essai-123456", HIGGSFIELD_API_URL: "https://higgsfield.exemple" };
const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  retouches.length = 0;
  appelsReseau.length = 0;
  vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
    appelsReseau.push(String(u));
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { estDemo: false, formatId: "facecam" });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", entrees: {} }, estDemo: false });
  await ecrireParametre("budget.mensuel", { centimes: 15_000, devise: "EUR" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(appelsReseau).toEqual([]);
});

async function versionCourante() {
  return (await depots().videos.obtenir(VIDEO))!.versionChoisieId!;
}

async function travailSur(versionId: string, id: string) {
  await depots().travaux.enregistrer({ id, type: "fabrication", cibleId: VIDEO, versionId, titre: "Fabrication", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: id, fournisseurUtilise: "simulation", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() } as never);
  return id;
}

/** Une demande écrite telle qu'en prod AVANT cette vérification (ancienne vidéo, carte affichée). */
async function demandeAncienne(optionId: DemandeConfirmation["optionId"], etat: DemandeConfirmation["etat"], jeton = "a".repeat(64)): Promise<DemandeConfirmation> {
  const d: DemandeConfirmation = {
    jeton,
    optionId,
    outil: optionId.startsWith("multicamera") ? "heygen" : "higgsfield",
    libelle: optionId === "decor-ia" ? "Décor IA" : "Vidéo en 3 caméras",
    videoId: VIDEO,
    versionOrigineId: await versionCourante(),
    montantCentimes: 1_200,
    etat,
    origine: "fabrication",
    creeLe: new Date(Date.now() - 3600_000).toISOString(),
    expireLe: new Date(Date.now() + 20 * 3600_000).toISOString(),
  };
  const liste = await lireParametre<DemandeConfirmation[]>(op.PARAM_DEMANDES, []);
  await ecrireParametre(op.PARAM_DEMANDES, [...liste, d]);
  return d;
}

/** Une version qui porte l'accord (comme après « Confirmer » avant cette vérification) et son travail. */
async function versionAvecAccord(optionId: string, jeton: string, id = "ver-accord"): Promise<string> {
  const ver = (await depots().versions.obtenir(await versionCourante()))!;
  await depots().versions.enregistrer({ ...ver, id, numero: 150, choisie: false, commande: { ...ver.commande, entrees: { facecamDecorIa: true, optionsPayantes: { accords: { [optionId]: jeton }, demandees: [optionId] } } } });
  return travailSur(id, `trav-${id}`);
}

function higgsfieldReelEspion(): FournisseurHiggsfield & { lancements: number } {
  const f = {
    id: "higgsfield" as const,
    mode: "reel" as const,
    lancements: 0,
    lireSolde: async () => ({ ok: true as const, credits: 10_000 }),
    envoyerMedia: async () => ({ ok: true as const, mediaId: "m" }),
    lancer: async () => (f.lancements++, { ok: true as const, idTravail: `t${f.lancements}` }),
    suivre: async () => ({ statut: "termine" as const, resultat: { url: "https://x/r.mp4", dureeSec: 10, largeur: 704, hauteur: 1248, ips: 24 } }),
    telecharger: async () => ({ ok: true as const, octets: new Uint8Array([1]) }),
  };
  return f;
}

const demandeDecor = (travailId: string, higgsfield: FournisseurHiggsfield) => ({
  videoId: VIDEO,
  travailId,
  dureeUtileSec: 10,
  lireImageReference: async () => ({ nom: "decor.jpg", type: "image/jpeg" as const, octets: new Uint8Array([1]) }),
  extrairePassage: async () => new Uint8Array([1]),
  deposerPassage: async () => "r2/passage.mp4",
  mesurer: async () => ({ ecartBoucheMs: 10, ressemblanceVisage: 0.97, visageTrouvePct: 100 }),
  attendre: async () => {},
  higgsfield,
});

/** Multicaméra réelle espionne : chaque look et chaque rendu HeyGen sont notés. */
function multicameraEspion(garde: Awaited<ReturnType<typeof gardeMulticamera>>) {
  const appels: string[] = [];
  const visage = { id: "heygen", mode: "reel", rendre: async () => (appels.push("rendre"), { idTravailExterne: "r" }), creerLook: async () => (appels.push("look"), { idExterne: "l" }) } as unknown as FournisseurVisage;
  const m = choisirFournisseurMulticamera({ reel: true, visage, analyseur: { mesurer: async () => ({ dureeSec: 1, decalageAudioMs: 0, visagePresentPct: 100 }) }, ...(garde ? { garde } : {}) });
  return { m, appels };
}

/* ------------------------------------------------------------------ */

describe("V4 · Décor IA retiré : il ne part jamais", () => {
  it("la carte Décor IA déjà affichée en prod sur une ancienne vidéo n'est plus montrée, et « Confirmer » ne lance rien", async () => {
    const d = await demandeAncienne("decor-ia", "en-attente");
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
    await expect(op.confirmerOptionPayante(d.jeton)).rejects.toMatchObject({ code: "REFUSE" });
    expect(retouches).toHaveLength(0);
    const apres = (await lireParametre<DemandeConfirmation[]>(op.PARAM_DEMANDES, [])).find((x) => x.jeton === d.jeton)!;
    expect(apres.etat).toBe("annulee");
  });

  it("un accord Décor IA déjà donné (confirmé, pas encore utilisé) ne dépense rien : aucun lancement Higgsfield", async () => {
    const d = await demandeAncienne("decor-ia", "confirmee");
    const travail = await versionAvecAccord("decor-ia", d.jeton);
    await ecrireParametre(PARAM_DECOR_IA, { actif: true, description: "bureau clair", imageReferenceCle: "decor.jpg", modele: "kling_video_edit", reel: true });
    const h = higgsfieldReelEspion();
    const r = await passeDecorFacecam(demandeDecor(travail, h));
    expect(h.lancements).toBe(0);
    expect(r?.statut ?? "non-lance").not.toBe("applique");
    expect(await op.gardePourTravail("decor-ia", travail).autoriser()).toBe(false);
    const hp = await higgsfieldPourOption("decor-ia", { travailId: travail, reel: true, dureeSec: 10 }, ENV_REEL);
    expect(hp.statut).not.toBe("pret");
  });

  it("aucune nouvelle carte Décor IA : ni par la fabrication, ni par le monteur, ni par Réglages", async () => {
    const r = await op.demanderOptionPayante("decor-ia", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    expect(r.statut).not.toBe("a-confirmer");
    await ecrireParametre(PARAM_DECOR_IA, { actif: true, description: "bureau", imageReferenceCle: "decor.jpg", modele: "kling_video_edit", reel: true });
    await passeDecorFacecam(demandeDecor(await travailSur(await versionCourante(), "trav-libre"), higgsfieldReelEspion()));
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
    const m = await discuterAvecMonteur(VIDEO, "change le décor : une bibliothèque");
    expect(m.monteur.confirmation).toBeUndefined();
    expect(m.monteur.texte).toMatch(/version gratuite|vrai décor/);
    expect(retouches).toHaveLength(0);
    const reglage = await op.carteReglages("decor-ia", { dureeSec: 60 });
    expect("phrase" in reglage).toBe(false);
    const allumer = await definirDecorIaAction({ actif: true }, { confirme: true });
    expect(allumer.ok).toBe(false);
  });
});

describe("V4 · interrupteur « Couper toutes les options payantes »", () => {
  it("coupé : aucune carte (fabrication, monteur), les cartes ouvertes disparaissent et ne se confirment plus, aucun rendu HeyGen", async () => {
    const ouverte = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    expect(ouverte.statut).toBe("a-confirmer");
    const res = await definirOptionsPayantesCoupeesAction(true);
    expect(res.ok).toBe(true);
    expect(await op.optionsPayantesCoupees()).toBe(true);

    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
    const r = await op.demanderOptionPayante("multicamera-avocat", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    expect(r.statut).not.toBe("a-confirmer");
    const m = await discuterAvecMonteur(VIDEO, "Monteur, fais-le en 3 caméras");
    expect(m.monteur.confirmation).toBeUndefined();
    expect(m.monteur.texte).toMatch(/version gratuite/);
    expect(m.monteur.texte).not.toMatch(/€/);
    if (ouverte.statut === "a-confirmer") await expect(op.confirmerOptionPayante(ouverte.carte.jeton)).rejects.toMatchObject({ code: "REFUSE" });
    expect(retouches).toHaveLength(0);
  });

  it("coupé APRÈS « Confirmer » : la garde refuse au moment de dépenser", async () => {
    const r = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    await definirOptionsPayantesCoupeesAction(true);
    const { m, appels } = multicameraEspion(await gardeMulticamera("multicamera-facecam", true, travailId, 60));
    await expect(m.rendreAngle({} as never)).rejects.toThrow(/non confirmée/);
    expect(appels).toEqual([]);
    // Rallumé : la confirmation, jamais utilisée, sert encore (une seule fois).
    await definirOptionsPayantesCoupeesAction(false);
    expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(true);
  });

  it("éteint par défaut (les options restent proposées avec leur carte) ; sans session, on ne change rien", async () => {
    expect(await op.optionsPayantesCoupees()).toBe(false);
    await auth.seDeconnecter();
    await expect(definirOptionsPayantesCoupeesAction(true)).rejects.toBeTruthy();
  });
});

describe("V4 · une confirmation ne vaut que pour la version qu'elle a lancée", () => {
  it("une autre version (retouche du monteur, format ajouté) qui recopie un jeton confirmé mais PAS ENCORE utilisé est refusée", async () => {
    const r = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    const versionConfirmee = (await depots().travaux.obtenir(travailId))!.versionId!;
    // Une version suivante recopie les entrées de la version confirmée AVANT qu'elle ait dépensé.
    const ver = (await depots().versions.obtenir(versionConfirmee))!;
    await depots().versions.enregistrer({ ...ver, id: "ver-copie", numero: 300, choisie: false });
    const copie = await travailSur("ver-copie", "trav-copie");
    const { m, appels } = multicameraEspion(await gardeMulticamera("multicamera-facecam", true, copie, 60));
    await expect(m.preparerLook({ visageId: "v", angle: "cote" })).rejects.toThrow(/non confirmée/);
    expect(appels).toEqual([]);
    // La version confirmée, elle, dépense une fois.
    expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(true);
  });
});

describe("V4 · relances et reprises après redémarrage : rien n'est payé deux fois", () => {
  it("la passe multicaméra reprise (nouvelle enveloppe, même travail) ne rend plus rien chez HeyGen", async () => {
    const r = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    const premier = multicameraEspion(await gardeMulticamera("multicamera-facecam", true, travailId, 60));
    await premier.m.preparerLook({ visageId: "v", angle: "cote" });
    expect(premier.appels).toEqual(["look"]);
    // Redémarrage / « Réessayer » : nouvelle enveloppe, même travail, même version.
    const reprise = multicameraEspion(await gardeMulticamera("multicamera-facecam", true, travailId, 60));
    await expect(reprise.m.preparerLook({ visageId: "v", angle: "cote" })).rejects.toThrow(/non confirmée/);
    expect(reprise.appels).toEqual([]);
    // La reprise ne crée pas non plus de carte à confirmer en douce : la vidéo sort en version gratuite.
    expect(retouches).toHaveLength(1);
  });

  it("« ultra réaliste » (I2) et effet réaliste (K) : sans accord porté par la version, le fournisseur réel n'est jamais rendu", async () => {
    const travail = await travailSur(await versionCourante(), "trav-i2");
    for (const option of ["effets-main-ultra", "effet-realiste-ia"] as const) {
      const h = await higgsfieldPourOption(option, { travailId: travail, reel: true, dureeSec: 5, passagesSec: [5] }, ENV_REEL);
      expect(h.statut).not.toBe("pret");
    }
  });
});

describe("V4 · trace dans les dépenses et cartes jamais recréées en douce", () => {
  async function fabriquerAvecAccord(travailId: string, rendus: string[]) {
    const { fabriquerSourcesMulticamera } = await import("@/services/multicamera");
    const visage = {
      id: "heygen",
      mode: "reel",
      rendre: async () => (rendus.push("rendre"), { idTravailExterne: `r${rendus.length}` }),
      creerLook: async () => (rendus.push("look"), { idExterne: "l" }),
      suivreRendu: async () => ({ statut: "termine" }),
      recuperer: async () => ({ videoCle: "angle.mp4", dureeSec: 30 }),
    } as unknown as FournisseurVisage;
    return fabriquerSourcesMulticamera(
      { travailId, visageId: "vis", priseCle: "prise.mp4", audioCle: "son.m4a", dureePriseSec: 30, ratio: "9:16", visage, analyseur: { mesurer: async () => ({ dureeSec: 30, decalageAudioMs: 0, visagePresentPct: 100 }) }, attendre: async () => {} },
      { actif: true, reel: true, looks: { vis: { cote: "look-cote", "contre-plongee": "look-cp" } } },
      "facecam",
    );
  }

  it("multicaméra HeyGen confirmée : chaque angle rendu est noté dans les dépenses de la vidéo", async () => {
    const r = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 30 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    const rendus: string[] = [];
    await fabriquerAvecAccord(travailId, rendus);
    expect(rendus).toEqual(["rendre", "rendre"]);
    const depenses = await depots().depenses.lister((x) => x.travailId === travailId);
    expect(depenses).toHaveLength(1);
    expect(depenses[0]).toMatchObject({ videoId: VIDEO, lignes: [{ fournisseur: "heygen", unite: "seconde", quantite: 60 }] });
    expect(depenses[0].total.centimes).toBeGreaterThan(0);
  });

  it("reprise de la même passe après dépense : aucun rendu, aucune nouvelle carte (un « Confirmer » de plus repaierait)", async () => {
    const r = await op.demanderOptionPayante("multicamera-facecam", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 30 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    await fabriquerAvecAccord(travailId, []);
    const rendus: string[] = [];
    await fabriquerAvecAccord(travailId, rendus);
    expect(rendus).toEqual([]);
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
    const ouvertes = (await lireParametre<DemandeConfirmation[]>(op.PARAM_DEMANDES, [])).filter((d) => d.etat === "en-attente");
    expect(ouvertes).toEqual([]);
  });

  it("sans option dans la version (réglage allumé) : la fabrication propose UNE carte et ne rend rien", async () => {
    const travail = await travailSur(await versionCourante(), "trav-sans-accord");
    const rendus: string[] = [];
    await fabriquerAvecAccord(travail, rendus);
    expect(rendus).toEqual([]);
    expect(await op.cartesEnAttente(VIDEO)).toHaveLength(1);
    expect(await depots().depenses.lister((x) => x.travailId === travail)).toEqual([]);
  });
});

describe("V4 · essais « Tester » de Réglages et veille : lectures gratuites seulement", () => {
  it("Tester et lire le solde (HeyGen, ElevenLabs, fal.ai, Claude) : uniquement des GET, aucune adresse qui fabrique", async () => {
    const { lecteursCredits } = await import("@/fournisseurs/credits");
    const appels: { methode: string; url: string }[] = [];
    const faux = (async (u: string | URL | Request, init?: RequestInit) => {
      appels.push({ methode: (init?.method ?? "GET").toUpperCase(), url: String(u) });
      return new Response(JSON.stringify({ data: { remaining_balance: 10, credits: 10 }, character_count: 1, character_limit: 10, prices: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const env = { HEYGEN_API_KEY: "cle-heygen-essai-123456", ELEVENLABS_API_KEY: "cle-eleven-essai-123456", FAL_KEY: "cle-fal-essai-123456", ANTHROPIC_API_KEY: "cle-claude-essai-123456" };
    for (const l of lecteursCredits(env, faux)) {
      await l.testerConnexion().catch(() => undefined);
      await l.lireSolde?.().catch(() => undefined);
    }
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) {
      expect(a.methode, a.url).toBe("GET");
      expect(a.url).not.toMatch(/\/v1\/messages|queue\.fal\.run|\/videos?\b(?!\/)|text-to-speech|\/speech|generate/);
    }
  });

  it("veille Claude : la liste des modèles (GET), jamais un message payant", async () => {
    const t = readFileSync(join(__dirname, "..", "src", "veille", "anthropic.ts"), "utf8");
    expect(t).toMatch(/\/v1\/models/);
    expect(t).not.toMatch(/\/v1\/messages|envoyerMessage|executerRole/);
    for (const f of readdirSync(join(__dirname, "..", "src", "veille"))) {
      const s = readFileSync(join(__dirname, "..", "src", "veille", f), "utf8");
      expect(s, f).not.toMatch(/envoyerMessage|executerRole|queue\.fal\.run|soumettre\(/);
    }
  });
});

describe("V4 · points d'appel payants : un seul chemin chacun (garde de structure)", () => {
  const racine = join(__dirname, "..", "src");
  const tous: string[] = [];
  (function parcourir(dossier: string) {
    for (const f of readdirSync(dossier)) {
      const p = join(dossier, f);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) tous.push(p.slice(racine.length + 1));
    }
  })(racine);
  const contenant = (motif: RegExp) => tous.filter((f) => motif.test(readFileSync(join(racine, f), "utf8"))).sort();

  it("Claude : `envoyerMessage` n'est appelé que par `executerRole` (lui-même appelé par le seul `appelerAvecRotation`, que prennent les 3 chemins plafonnés, comité éditorial compris)", () => {
    expect(contenant(/envoyerMessage\(/)).toEqual(["fournisseurs/claude/client.ts", "fournisseurs/claude/inscription.ts"]);
    expect(contenant(/\bexecuterRole\(/).filter((f) => !f.startsWith("fournisseurs/claude/"))).toEqual(["services/generation-claude.ts"]);
    expect(contenant(/\bappelerAvecRotation\(/)).toEqual(["services/comite-editorial.ts", "services/depense-claude-video.ts", "services/generation-claude.ts"]);
  });

  it("Claude, lots groupés : un lot n'est créé que par le comité éditorial (plafond des idées, pire cas réservé)", () => {
    expect(contenant(/\bcreerLot\(/)).toEqual(["fournisseurs/claude/lots.ts", "services/comite-editorial.ts"]);
  });

  it("fal.ai : un seul POST payant (`queue.fal.run`), dans le client fal", () => {
    expect(contenant(/queue\.fal\.run/)).toEqual(["fournisseurs/illustration/fal.ts"]);
  });

  it("Higgsfield réel : construit seulement par la fabrique gardée", () => {
    expect(contenant(/creerHiggsfieldHttp\(/)).toEqual(["fournisseurs/higgsfield/client.ts", "fournisseurs/higgsfield/index.ts"]);
  });

  it("Buffer : une seule écriture (`createPost`), le reste en lecture", () => {
    // Le texte GraphQL d'une écriture (`mutation Nom(`) n'existe qu'à un endroit ; ce n'est qu'un brouillon par défaut.
    expect(contenant(/`\s*mutation\s+\w+\s*\(/)).toEqual(["fournisseurs/publication/requetes.ts"]);
    expect(contenant(/MUTATION_CREER_POST/)).toEqual(["fournisseurs/publication/buffer.ts", "fournisseurs/publication/requetes.ts"]);
  });

  it("relecture des images par Claude : toujours comptée dans le plafond de la version (début du travail)", () => {
    const t = readFileSync(join(racine, "services/facecam-branchements.ts"), "utf8");
    const appels = t.match(/relireImagesControle\([\s\S]*?\);/g) ?? [];
    expect(appels.length).toBeGreaterThanOrEqual(2);
    for (const a of appels) expect(a).toMatch(/depuis: await debutDuTravail\(/);
  });
});
