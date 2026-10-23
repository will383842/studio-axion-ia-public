/**
 * LOT K — « Effet réaliste par IA », côté SERVEUR et MONTEUR (décision de Will du 09/10) : Claude choisit le moment
 * dans son appel unique (vérifié), la carte de confirmation part dans le fil avec l'aperçu, rien n'est dépensé ni
 * fabriqué sans « Confirmer », « Changer de moment », Annuler → version gratuite, Confirmer → l'effet et ses passages
 * liés entrent dans la nouvelle version, la passe ne lance rien sans accord porté par la version, reprise d'un effet
 * déjà payé, retouche qui ne refait que la piste montée. Dépôts en mémoire, fetch interdit, aucun appel réel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

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
      const versionId = `ver-k-${n}`;
      const travailId = `trav-k-${n}`;
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 200 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "fabrication", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", finEstimee: new Date(Date.now() + 20 * 60_000).toISOString(), creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const op = await import("@/services/options-payantes");
const { discuterAvecMonteur, filMonteur, deposerJsonGz } = await import("@/services/monteur-facecam");
const effets = await import("@/services/effet-realiste-ia");
const { piloterMonteur, reglagesMonteurVides, effetDuPassage, partiesARefaireEffets } = await (async () => {
  const m = await import("@/moteurs/montage-facecam/monteur");
  const r = await import("@/moteurs/montage-facecam/retouche");
  return { ...m, partiesARefaireEffets: (a: Record<string, unknown>, b: Record<string, unknown>) => r.partiesARefaire(r.signatureMontage(a), r.signatureMontage(b)) };
})();
const { creerHiggsfieldSimule } = await import("@/fournisseurs/higgsfield/simulation");
import type { EffetRealistePrepare } from "@/briques/effet-realiste";
import type { MotHorodate } from "@/domaine/types";

const MDP = "essai-effet-realiste";
const VIDEO = "v-04";
const appelsReseau: string[] = [];

/** Prise : accroche, une phrase, la phrase du téléphone, la conclusion (≈ 22 s). */
function motsPrise(): MotHorodate[] {
  const phrases = [
    "Bonjour, voici trois erreurs à éviter absolument.",
    "La première, c'est de tout faire seul sans méthode ni outil.",
    "Regardez mon téléphone, tout passe par lui aujourd'hui pour vos clients et vos rendez-vous.",
    "Abonnez-vous pour la suite, le lien est dessous.",
  ];
  const mots: MotHorodate[] = [];
  let t = 0.4;
  for (const p of phrases) {
    for (const mot of p.split(" ")) {
      mots.push({ mot, debutSec: +t.toFixed(3), finSec: +(t + 0.32).toFixed(3) });
      t += 0.4;
    }
    t += 0.6;
  }
  return mots;
}

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
  await deposerJsonGz("facecam/v-04/transcription.json.gz", { mots: motsPrise() });
  await depots().videos.modifier(VIDEO, { estDemo: false, formatId: "facecam" });
  await depots().versions.modifier(ver.id, {
    commande: { ...ver.commande, formatId: "facecam", entrees: { facecam: { transcriptionCle: "facecam/v-04/transcription.json.gz", coupes: { auto: [], retablies: [] }, passages: [], consignes: [], image: { lumiere: "juste", couleurs: "juste", mine: "juste", dents: "juste" } } } },
    estDemo: false,
  });
  await ecrireParametre("budget.mensuel", { centimes: 15_000, devise: "EUR" });
});
afterEach(() => vi.unstubAllGlobals());

const versionCourante = async () => (await depots().videos.obtenir(VIDEO))!.versionChoisieId!;

async function demanderEffet(message = "Mets un téléphone dans ma main et jette-le sur l'écran") {
  const r = await discuterAvecMonteur(VIDEO, message);
  return r.monteur;
}

describe("lot K · le monteur prépare l'effet (un appel Claude), il ne le pose pas", () => {
  it("Claude choisit le moment et écrit la consigne anglaise ; le code vérifie, ajoute les règles et les passages liés", async () => {
    const mots = motsPrise();
    const regardez = mots.findIndex((m) => m.mot === "Regardez");
    let appels = 0;
    const r = await piloterMonteur(
      {
        titre: "Trois erreurs",
        mots,
        dureePriseSec: mots[mots.length - 1].finSec,
        etat: { facecam: { coupes: { auto: [], retablies: [] }, passages: [], consignes: [], image: { lumiere: "juste", couleurs: "juste", mine: "juste", dents: "juste" } } as never, reglages: reglagesMonteurVides() },
        message: "Rajoute au bon endroit un téléphone dans ma main et jette-le sur l'écran",
        plafondAtteint: false,
      },
      {
        appeler: async () => {
          appels++;
          return {
            ok: true,
            simule: false,
            donnees: {
              reponse: "Je propose de le faire quand vous montrez votre téléphone.",
              operations: [
                {
                  type: "effetRealisteIA",
                  consigne: "téléphone dans ma main, jeté sur l'écran",
                  ancre: "bon-endroit",
                  debutMot: regardez,
                  instantSec: null,
                  dureeSec: 5,
                  consigneVideo: "A black smartphone appears in the person's open hand, palm up; he throws it toward the camera and it hits the lens.",
                  objet: "telephone",
                  imageReference: null,
                  finitSurEcran: true,
                  sonSuggere: "verre",
                  raisonMoment: "Vous montrez votre téléphone",
                },
              ],
              consignes: [{ consigneId: "fil", comprise: true, resume: "Effet réaliste préparé", operations: [0] }],
            },
          };
        },
        nouvelId: (() => {
          let n = 0;
          return (p: string) => `${p}-${++n}`;
        })(),
      },
    );
    expect(appels).toBe(1);
    expect(r.aConfirmer).toHaveLength(1);
    // Rien n'est posé tant que Will n'a pas confirmé.
    expect(r.etat.facecam.passages).toHaveLength(0);
    const { effet, passagesLies } = r.aConfirmer[0];
    expect(effet.debutMot).toBe(regardez);
    expect(effet.raisonMoment).toBe("Vous montrez votre téléphone");
    expect(effet.consigneVideo).toMatch(/^A black smartphone appears/);
    expect(effet.consigneVideo).toMatch(/lip movements/);
    expect(effet.modele).toBe("flux_3_video_edit");
    expect(effet.finitSurEcran).toBe(true);
    // Vitre brisée à l'impact (si réussi) et téléphone 3D sur la paume (si raté).
    const conditions = passagesLies.map((p) => [(p.operation as { type: string }).type, (p as unknown as { conditionEffetRealiste: { si: string } }).conditionEffetRealiste.si]);
    expect(conditions).toEqual([
      ["vitreBrisee", "reussi"],
      ["objetMain", "rate"],
    ]);
    const vitre = passagesLies[0];
    expect(vitre.debutSec).toBeGreaterThan(effet.debutSec);
    expect(vitre.debutSec).toBeLessThanOrEqual(effet.finSec);
    expect((vitre.operation as { bruitage: boolean }).bruitage).toBe(true);
  });
});

describe("lot K · fil « Discuter avec mon monteur » : carte avant toute dépense", () => {
  it("la carte « Effet réaliste par IA — option payante… » part avec l'aperçu ; aucune version, aucun appel réseau", async () => {
    const m = await demanderEffet();
    expect(m.confirmation?.optionId).toBe("effet-realiste-ia");
    expect(m.confirmation?.phrase).toMatch(/^Effet réaliste par IA — option payante, (environ \d+ €|moins de 1 €) pris sur vos crédits Higgsfield\.$/);
    expect(m.confirmation?.apercu?.instant).toMatch(/^\d:\d\d$/);
    expect(m.confirmation?.apercu?.phrase).toMatch(/téléphone/);
    expect(m.texte).toMatch(/option payante/);
    expect(retouches).toHaveLength(0);
    expect(appelsReseau).toHaveLength(0);
    const ouverte = await op.demandeOuverte("effet-realiste-ia", VIDEO);
    expect((ouverte?.details as { effet: EffetRealistePrepare }).effet.objet).toBe("telephone");
  });

  it("« plutôt à 0:05 » : la carte est refaite à ce moment, l'ancienne demande est annulée (rien dépensé)", async () => {
    const premiere = await demanderEffet();
    const m = (await discuterAvecMonteur(VIDEO, "Plutôt à 0:05")).monteur;
    expect(m.confirmation?.jeton).not.toBe(premiere.confirmation?.jeton);
    expect(Math.abs(m.confirmation!.apercu!.instantSec - 5)).toBeLessThan(1.5);
    const demandes = await lireParametre<{ jeton: string; etat: string }[]>(op.PARAM_DEMANDES, []);
    expect(demandes.find((d) => d.jeton === premiere.confirmation?.jeton)?.etat).toBe("annulee");
    expect(retouches).toHaveLength(0);
  });

  it("Annuler : aucune version, la vidéo reste gratuite", async () => {
    const m = await demanderEffet();
    await op.annulerOptionPayante(m.confirmation!.jeton);
    expect(retouches).toHaveLength(0);
    expect((await filMonteur(VIDEO)).at(-1)?.texte).toMatch(/version gratuite/);
  });

  it("Confirmer : l'effet, la vitre brisée et le repli 3D entrent dans la nouvelle version ; « Prête vers … »", async () => {
    const m = await demanderEffet();
    await op.confirmerOptionPayante(m.confirmation!.jeton);
    expect(retouches).toHaveLength(1);
    const entrees = retouches[0].entrees!;
    const passages = (entrees.facecam as { passages: unknown[] }).passages as never[];
    const effet = passages.map(effetDuPassage).find(Boolean)!;
    expect(effet.consigneVideo).toMatch(/smartphone/);
    expect(passages).toHaveLength(3);
    expect((entrees.optionsPayantes as { accords: Record<string, string> }).accords["effet-realiste-ia"]).toBe(m.confirmation!.jeton);
    expect((await filMonteur(VIDEO)).at(-1)?.texte).toMatch(/l'effet est en fabrication\. La version actuelle reste visible en attendant ; la nouvelle sera prête vers \d+ h \d\d\./);
  });
});

describe("lot K · fabrication : jamais sans accord porté par la version", () => {
  const passagesOk = () => ({
    extrairePassage: async () => new Uint8Array([1]),
    deposerPassage: async () => "r2/effet.mp4",
    mesurer: async () => ({ ecartBoucheMs: 10, ressemblanceVisage: 0.97, visageTrouvePct: 100 }),
  });

  async function effetConfirme() {
    const m = await demanderEffet();
    await op.confirmerOptionPayante(m.confirmation!.jeton);
    const passages = (retouches[0].entrees!.facecam as { passages: never[] }).passages;
    return passages.map(effetDuPassage).find(Boolean)!;
  }

  it("version gratuite (aucune confirmation) : rien n'est lancé, même en réel ; aucune nouvelle carte", async () => {
    await ecrireParametre(effets.PARAM_REGLAGE_EFFET, { reel: true });
    const m = await demanderEffet();
    const effet = (m.confirmation ? ((await op.demandeOuverte("effet-realiste-ia", VIDEO))!.details as { effet: EffetRealistePrepare }).effet : null)!;
    await depots().travaux.enregistrer({ id: "trav-gratuit", type: "fabrication", cibleId: VIDEO, versionId: await versionCourante(), titre: "Fabrication", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: "trav-gratuit", fournisseurUtilise: "simulation", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() } as never);
    const avant = (await lireParametre<unknown[]>(op.PARAM_DEMANDES, [])).length;
    const r = await effets.passeEffetsRealistesFacecam({ videoId: VIDEO, travailId: "trav-gratuit", effets: [effet], passages: passagesOk() });
    expect(r[0]).toMatchObject({ statut: "non-lance", raison: "non-confirme", message: "Effet non réussi — Réessayer" });
    expect((await lireParametre<unknown[]>(op.PARAM_DEMANDES, [])).length).toBe(avant);
    expect(appelsReseau).toHaveLength(0);
  });

  it("version confirmée (double de simulation) : effet fabriqué, morceau rangé, fenêtre gardée ; repris ensuite sans repayer", async () => {
    const effet = await effetConfirme();
    const fenetre = { x: 1312, y: 0, largeur: 1214, hauteur: 2160 };
    const r = await effets.passeEffetsRealistesFacecam({ videoId: VIDEO, travailId: "trav-k-1", effets: [effet], passages: passagesOk(), fenetre });
    expect(r[0].statut).toBe("reussi");
    if (r[0].statut === "reussi") expect(r[0].morceau).toMatchObject({ source: "effet", fichierCle: "r2/effet.mp4", fenetre });
    const depenses = (await depots().depenses.lister(() => true)).filter((d) => d.lignes.some((l) => l.etape === "Effet réaliste par IA"));
    expect(depenses).toHaveLength(1);
    expect(depenses[0].lignes[0].fournisseur).toBe("simulation");
    // Une retouche gratuite suivante (même effet) : repris, aucun nouvel envoi.
    const h = creerHiggsfieldSimule();
    const encore = await effets.passeEffetsRealistesFacecam({ videoId: VIDEO, travailId: "trav-autre", effets: [effet], passages: passagesOk(), higgsfield: h });
    expect(encore[0]).toMatchObject({ statut: "reussi", creditsDebites: 0 });
    expect(h.lancements).toHaveLength(0);
  });

  it("échec du modèle : repli gratuit, « Effet non réussi — Réessayer » sur Votre vidéo, et Réessayer redemande une confirmation", async () => {
    const effet = await effetConfirme();
    const h = creerHiggsfieldSimule({ lancementsEnEchec: [0], echec: "refus" });
    const r = await effets.passeEffetsRealistesFacecam({ videoId: VIDEO, travailId: "trav-k-1", effets: [effet], passages: passagesOk(), higgsfield: h });
    expect(r[0]).toMatchObject({ statut: "rate", raison: "refus" });
    expect([...(await effets.effetsRealistesRates(VIDEO))]).toEqual([effet.id]);
    // Réessayer : une nouvelle carte (aucun lancement sans « Confirmer »).
    await depots().videos.modifier(VIDEO, { versionChoisieId: "ver-k-1" });
    const { reessayerEffetPassage } = await import("@/services/monteur-facecam");
    expect(await reessayerEffetPassage(VIDEO, effet.id)).toEqual({ aConfirmer: true });
    expect((await filMonteur(VIDEO)).at(-1)?.confirmation?.optionId).toBe("effet-realiste-ia");
    expect(h.lancements).toHaveLength(1);
  });

  it("Décor IA appliqué : l'effet n'est pas lancé (il ramènerait le vrai décor sur son passage)", async () => {
    const effet = await effetConfirme();
    const h = creerHiggsfieldSimule();
    const r = await effets.passeEffetsRealistesFacecam({ videoId: VIDEO, travailId: "trav-k-1", effets: [effet], passages: passagesOk(), higgsfield: h, decorApplique: true });
    expect(r[0]).toMatchObject({ statut: "non-lance", raison: "decor-ia" });
    expect(h.lancements).toHaveLength(0);
  });

  it("retouche : un effet ajouté ne refait que la piste montée (ni l'image, ni le son)", async () => {
    const effet = await effetConfirme();
    const avant = (await depots().versions.obtenir(await versionCourante()))!.commande.entrees as Record<string, unknown>;
    const parties = partiesARefaireEffets(avant, retouches[0].entrees!);
    expect([...parties].sort()).toEqual(["effets", "habillage"]);
    expect(effet.id).toBeTruthy();
  });
});
