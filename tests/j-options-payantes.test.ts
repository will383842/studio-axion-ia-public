/**
 * LOT J — options payantes, côté SERVEUR (décision de Will du 09/10) : aucune option payante ne part sans
 * confirmation valide (contrôle au moment de l'appel au fournisseur), confirmation à usage unique liée à la version,
 * annulation → version gratuite, plafond toujours prioritaire, fil du monteur « à confirmer », et rien d'autre
 * n'affiche de prix. Dépôts en mémoire, aucun réseau (fetch interdit), aucun appel réel.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

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
      const versionId = `ver-j-${n}`;
      const travailId = `trav-j-${n}`;
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 100 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "fabrication", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const op = await import("@/services/options-payantes");
const { discuterAvecMonteur, filMonteur } = await import("@/services/monteur-facecam");
const { passeDecorFacecam, PARAM_DECOR_IA } = await import("@/services/decor-ia");
const { fournisseurHiggsfield } = await import("@/fournisseurs/higgsfield");
const { choisirFournisseurMulticamera } = await import("@/fournisseurs/multicamera");
import type { FournisseurHiggsfield } from "@/fournisseurs/higgsfield/types";
import type { FournisseurVisage } from "@/fournisseurs/types";

const MDP = "essai-options-payantes";
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
  // v-04 devient une vraie vidéo face caméra.
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { estDemo: false, formatId: "facecam" });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", entrees: {} }, estDemo: false });
  await ecrireParametre("budget.mensuel", { centimes: 15_000, devise: "EUR" });
});
afterEach(() => vi.unstubAllGlobals());

async function versionCourante() {
  return (await depots().videos.obtenir(VIDEO))!.versionChoisieId!;
}

/** Un travail sur la version courante (la version gratuite, sans accord). */
async function travailVersionCourante(id = "trav-gratuit") {
  await depots().travaux.enregistrer({ id, type: "fabrication", cibleId: VIDEO, versionId: await versionCourante(), titre: "Fabrication", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: id, fournisseurUtilise: "simulation", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() } as never);
  return id;
}

async function demandeEnAttente(optionId: "decor-ia" | "multicamera-facecam" = "multicamera-facecam") {
  const r = await op.demanderOptionPayante(optionId, { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 60 }, "fabrication");
  if (r.statut !== "a-confirmer") throw new Error("plafond inattendu");
  return r.carte;
}

/** Faux client Higgsfield RÉEL : chaque appel est noté ; tout réussit. */
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

const demandeDecor = (travailId: string, higgsfield?: FournisseurHiggsfield) => ({
  videoId: VIDEO,
  travailId,
  dureeUtileSec: 10,
  lireImageReference: async () => ({ nom: "decor.jpg", type: "image/jpeg" as const, octets: new Uint8Array([1]) }),
  extrairePassage: async () => new Uint8Array([1]),
  deposerPassage: async () => "r2/passage.mp4",
  mesurer: async () => ({ ecartBoucheMs: 10, ressemblanceVisage: 0.97, visageTrouvePct: 100 }),
  attendre: async () => {},
  ...(higgsfield ? { higgsfield } : {}),
});

describe("lot J · aucune option payante sans confirmation (serveur)", () => {
  it("fournisseurs réels sans garde : aucun lancement Higgsfield, aucun rendu HeyGen", async () => {
    const h = fournisseurHiggsfield({ reel: true }, ENV_REEL);
    expect(h.mode).toBe("reel");
    const r = await h.lancer({ modele: "kling_video_edit", videoMediaId: "m", consigne: "c", dureeSec: 10, idempotence: "i" });
    expect(r.ok).toBe(false);
    expect(appelsReseau).toEqual([]);

    const appels: string[] = [];
    const visage = { id: "heygen", mode: "reel", rendre: async () => (appels.push("rendre"), { idTravailExterne: "r" }), creerLook: async () => (appels.push("look"), { idExterne: "l" }) } as unknown as FournisseurVisage;
    const m = choisirFournisseurMulticamera({ reel: true, visage, analyseur: { mesurer: async () => ({ dureeSec: 1, decalageAudioMs: 0, visagePresentPct: 100 }) } });
    await expect(m.rendreAngle({} as never)).rejects.toThrow(/non confirmée/);
    await expect(m.preparerLook({ visageId: "v", angle: "cote" })).rejects.toThrow(/non confirmée/);
    expect(appels).toEqual([]);
  });

  it("Décor IA réel allumé : rien n'est envoyé et, depuis la vérif V4 (Décor IA retiré), aucune carte n'est proposée", async () => {
    await ecrireParametre(PARAM_DECOR_IA, { actif: true, description: "bureau clair, grande fenêtre", imageReferenceCle: "decor.jpg", modele: "kling_video_edit", reel: true });
    const h = higgsfieldReelEspion();
    const r = await passeDecorFacecam(demandeDecor(await travailVersionCourante(), h));
    expect(r).toMatchObject({ statut: "non-lance", lignes: [], creditsDebites: 0 });
    expect(r!.message).toMatch(/vrai décor est gardé, rien n'est dépensé/);
    expect(r!.message).not.toMatch(/€/);
    expect(h.lancements).toBe(0);
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
  });

  it("option Higgsfield confirmée (ultra réaliste) : la version suivante dépense UNE fois ; une autre passe ne repaie pas", async () => {
    const r = await op.demanderOptionPayante("effets-main-ultra", { videoId: VIDEO, versionId: await versionCourante(), dureeSec: 10 }, "fabrication");
    if (r.statut !== "a-confirmer") throw new Error("carte attendue");
    const { travailId } = await op.confirmerOptionPayante(r.carte.jeton);
    expect(retouches.at(-1)!.entrees).toMatchObject({ optionsPayantes: { accords: { "effets-main-ultra": r.carte.jeton }, demandees: ["effets-main-ultra"] } });
    const { garderHiggsfield } = await import("@/briques/options-payantes/garde");
    const lancement = { modele: "kling_video_edit" as const, videoMediaId: "m", consigne: "c", dureeSec: 5, idempotence: "i" };
    const h = higgsfieldReelEspion();
    const g = garderHiggsfield(h, op.gardePourTravail("effets-main-ultra", travailId));
    expect((await g.lancer(lancement)).ok).toBe(true);
    expect((await g.lancer(lancement)).ok).toBe(true);
    expect(h.lancements).toBe(2);
    // Même travail, nouvelle passe : le jeton est déjà utilisé → plus rien ne part.
    const h2 = higgsfieldReelEspion();
    expect((await garderHiggsfield(h2, op.gardePourTravail("effets-main-ultra", travailId)).lancer(lancement)).ok).toBe(false);
    expect(h2.lancements).toBe(0);
  });
});

describe("lot J · confirmation à usage unique", () => {
  it("la garde de la version confirmée autorise une fois ; une deuxième garde, ou une version qui recopie le jeton, est refusée", async () => {
    const carte = await demandeEnAttente();
    const { travailId } = await op.confirmerOptionPayante(carte.jeton);
    expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(true);
    expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(false);
    // Une version suivante (retouche du monteur) recopie les entrées, donc le jeton : refusé.
    const copie = await travailVersionCourante("trav-copie");
    const ver = (await depots().travaux.obtenir(travailId))!.versionId!;
    await depots().travaux.modifier(copie, { versionId: ver });
    expect(await op.gardePourTravail("multicamera-facecam", copie).autoriser()).toBe(false);
    // Le jeton d'une option ne vaut pas pour une autre.
    expect(await op.gardePourTravail("decor-ia", travailId).autoriser()).toBe(false);
  });

  it("deux réponses : la seconde est refusée ; un jeton inconnu aussi", async () => {
    const carte = await demandeEnAttente();
    await op.confirmerOptionPayante(carte.jeton);
    await expect(op.confirmerOptionPayante(carte.jeton)).rejects.toMatchObject({ code: "REFUSE" });
    await expect(op.annulerOptionPayante(carte.jeton)).rejects.toMatchObject({ code: "REFUSE" });
    await expect(op.confirmerOptionPayante("z".repeat(64))).rejects.toMatchObject({ code: "INTROUVABLE" });
    expect(retouches).toHaveLength(1);
  });

  it("une confirmation n'est pas utilisable après 24 h", async () => {
    const carte = await demandeEnAttente();
    const { travailId } = await op.confirmerOptionPayante(carte.jeton);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 24 * 3600 * 1000 + 1000);
      expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // L3-01 (audit argent) : options payantes « hors porte » (tests/l3-0-garde-origine.test.ts § 5) parce que seul le clic
  // « Confirmer » de Will rend un jeton valide. Une commande de l'Usine qui écrit un jeton dans ses entrées n'obtient rien.
  it("commande de l'Usine portant un jeton dans ses entrées (inventé, ou d'une carte pas encore confirmée) : aucune garde ne s'ouvre", async () => {
    const { avecAccord } = await import("@/briques/options-payantes");
    const carte = await demandeEnAttente();
    const travailId = await travailVersionCourante("trav-usine");
    const ver = (await depots().versions.obtenir(await versionCourante()))!;
    for (const jeton of ["z".repeat(64), carte.jeton]) {
      await depots().versions.modifier(ver.id, { commande: { ...ver.commande, origine: "usine", entrees: avecAccord({}, "multicamera-facecam", jeton) } });
      expect(await op.accordValide("multicamera-facecam", travailId)).toBe(false);
      expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(false);
    }
    expect(retouches).toHaveLength(0);
    expect(appelsReseau).toEqual([]);
  });

  it("sans session, on ne confirme rien", async () => {
    const carte = await demandeEnAttente();
    await auth.seDeconnecter();
    await expect(op.confirmerOptionPayante(carte.jeton)).rejects.toBeTruthy();
    expect(retouches).toHaveLength(0);
  });
});

describe("lot J · annulation → version gratuite", () => {
  it("Annuler : aucune nouvelle version, rien d'autorisé, la carte disparaît", async () => {
    const carte = await demandeEnAttente();
    await op.annulerOptionPayante(carte.jeton);
    expect(retouches).toHaveLength(0);
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);
    expect(await op.gardePourTravail("multicamera-facecam", await travailVersionCourante()).autoriser()).toBe(false);
  });
});

describe("lot J · le monteur répond « à confirmer »", () => {
  it("« Monteur, fais-le en 3 caméras » : carte dans le fil, pas de nouvelle version ; Confirmer → nouvelle version avec l'option", async () => {
    const r = await discuterAvecMonteur(VIDEO, "Monteur, fais-le en 3 caméras");
    expect(r.monteur.confirmation).toMatchObject({ optionId: "multicamera-facecam", etat: "en-attente", phrase: expect.stringMatching(/crédits HeyGen/) });
    expect(r.monteur.versionId).toBeUndefined();
    expect(retouches).toHaveLength(0);
    // La carte du fil n'est pas répétée sur « Votre vidéo ».
    expect(await op.cartesEnAttente(VIDEO)).toEqual([]);

    await op.confirmerOptionPayante(r.monteur.confirmation!.jeton);
    expect(retouches).toHaveLength(1);
    expect(retouches[0].consigne).toBe("Monteur : Monteur, fais-le en 3 caméras");
    const fil = await filMonteur(VIDEO);
    expect(fil.find((e) => e.id === r.monteur.id)!.confirmation!.etat).toBe("confirmee");
    expect(fil.at(-1)).toMatchObject({ de: "monteur", texte: expect.stringMatching(/confirmé/), travailId: "trav-j-1" });
  });

  it("sans confirmation, rien ; Annuler → le monteur garde la version gratuite", async () => {
    const r = await discuterAvecMonteur(VIDEO, "Monteur, fais-le en 3 caméras");
    await op.annulerOptionPayante(r.monteur.confirmation!.jeton);
    expect(retouches).toHaveLength(0);
    const fil = await filMonteur(VIDEO);
    expect(fil.at(-1)!.texte).toMatch(/version gratuite/);
    expect(fil.find((e) => e.id === r.monteur.id)!.confirmation!.etat).toBe("annulee");
  });
});

describe("lot J · plafond toujours prioritaire", () => {
  it("plafond du mois trop bas : pas de carte, le monteur le dit, rien ne part", async () => {
    await ecrireParametre("budget.mensuel", { centimes: 100, devise: "EUR" });
    const r = await discuterAvecMonteur(VIDEO, "Monteur, fais-le en 3 caméras");
    expect(r.monteur.confirmation).toBeUndefined();
    expect(r.monteur.texte).toMatch(/plafond du mois/i);
    expect(r.monteur.texte).not.toMatch(/€/);
  });

  it("confirmée puis plafond atteint avant l'appel : refusée quand même", async () => {
    const carte = await demandeEnAttente();
    const { travailId } = await op.confirmerOptionPayante(carte.jeton);
    await ecrireParametre("budget.mensuel", { centimes: 100, devise: "EUR" });
    expect(await op.gardePourTravail("multicamera-facecam", travailId).autoriser()).toBe(false);
  });
});

describe("lot J · rien d'autre n'affiche de prix", () => {
  const racine = join(__dirname, "..", "src");
  const lire = (p: string) => readFileSync(join(racine, p), "utf8");

  it("écrans face caméra et Décor IA : aucun montant ni formatage de prix ; seule la carte en montre un", () => {
    // MonMonteur.tsx = Réglages › Mon monteur : total du mois et plafond, les seuls montants permis hors de la carte.
    const fichiers = [...readdirSync(join(racine, "components/facecam")).filter((f) => f !== "MonMonteur.tsx").map((f) => `components/facecam/${f}`), "components/reglages/DecorIa.tsx"];
    for (const f of fichiers) {
      const t = lire(f);
      expect(t, f).not.toMatch(/formaterMontant|€|montantCentimes|phraseCarte/);
    }
    // La carte est le seul composant qui pose la phrase avec le montant.
    expect(lire("components/options-payantes/CarteOptionPayante.tsx")).toMatch(/phrase/);
  });

  it("messages du décor et du monteur : sans montant", async () => {
    const { MESSAGES_DECOR } = await import("@/briques/decor/passe");
    const b = await import("@/briques/options-payantes");
    for (const m of [...Object.values(MESSAGES_DECOR), b.REPONSE_MONTEUR_A_CONFIRMER, b.REPONSE_MONTEUR_ANNULEE, b.REPONSE_MONTEUR_CONFIRMEE, b.REPONSE_MONTEUR_PLAFOND, b.MESSAGE_PLAFOND, b.MESSAGE_NON_CONFIRMEE, op.MESSAGE_EN_ATTENTE]) {
      expect(m).not.toMatch(/€|\d+ ?(c|centimes|euros?)\b/);
    }
  });
});
