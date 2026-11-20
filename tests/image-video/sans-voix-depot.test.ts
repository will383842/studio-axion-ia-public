/**
 * IV-SV · dépôt « Sans voix (sous-titres et texte à l'écran) » par les VRAIS services (base en mémoire, fournisseurs
 * payants en doubles) : aucune voix cherchée ni exigée, brouillon sans distribution, lancement accepté, 0 appel HeyGen,
 * prix sans ligne de voix. Le dépôt avec voix reste refusé quand la voix manque.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { carteFixe, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { PREFIXE_DECISIONS } = await import("@/services/image-video");
const { deposerFichierSimule } = await import("@/services/fichiers");
const ecran = await import("@/services/image-video-ecran");
const texte = await import("@/services/image-video-texte");
const lot = await import("@/services/image-video-lot");
const { brancherServicesImageVideo } = await import("@/moteurs/montage-image-video");
const { RESEAUX_IV } = await import("@/domaine/image-video/plafonds");
const { ID_FORMAT_IMAGE_VIDEO } = await import("@/formats/image-video");

const MDP = "image-video-depot-studio";
const carte = carteFixe("C");

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Fournisseurs payants en doubles, branchés APRÈS l'import de la boucle (qui branche les outils réels). Les décisions de
  // Will sont celles gardées par le studio, comme en production : le double seul n'en a pas. Avant le raccord de la boucle,
  // le premier chargement tardif de `image-video.ts` (par l'écran) écrasait ce double et fournissait ces décisions sans le dire.
  brancherServicesImageVideo({
    outils: async (commande) => {
      const gardees = async () => lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${commande.videoId}`, null);
      return { ...outilsSimules(carte, monde()), decisions: { carte: async () => ((await gardees())?.carte ?? null) as never, script: async () => ((await gardees())?.script ?? null) as never } };
    },
  });
});

/** L'image du chatbot déposée par l'écran (dépôt simulé du studio, aucun octet envoyé). */
async function imageDeposee() {
  const f = await deposerFichierSimule({ nom: "chatbot-24h.png", mime: "image/png", taille: 400_000, typeEntite: "entree", entiteId: "image-video" });
  // Empreinte de l'image du jeu d'essai : l'écriture simulée retrouve sa fiche par elle.
  return depots().fichiers.modifier(f.id, { sha256: carte.image.empreinte });
}


const videosIV = () => depots().videos.lister((v) => v.formatId === ID_FORMAT_IMAGE_VIDEO);
const sansVoixDispo = async () => {
  throw new Error("la voix ne doit pas être cherchée en mode sans voix");
};

describe("IV-SV · le dépôt sans voix", () => {
  it("sans voix prête : lancée, distribution vide, choix gardé dans les entrées, prix sans voix", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const fichier = await imageDeposee();
    const etat = await ecran.etatDepotImageVideo({ voix: async () => null });
    expect(etat.blocageSansVoix).toBeUndefined();
    expect(etat.montantSansVoixCentimes).toBeLessThan(etat.montantCentimes);
    expect(etat.montantSansVoixCentimes).toBe(ecran.prixDuDepot(RESEAUX_IV, etat.tauxUsdEur, 50, true));

    const issue = await ecran.deposerImageVideo(
      { fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: etat.montantSansVoixCentimes, sansVoix: true },
      { voix: sansVoixDispo },
    );
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    const [video] = await videosIV();
    expect(video.distribution).toEqual([]);
    expect((video.entrees?.imageVideo as { sansVoix?: boolean }).sansVoix).toBe(true);
    expect((video.entrees?.imageVideo as { plafondCentimes?: number }).plafondCentimes).toBe(etat.montantSansVoixCentimes);
  });

  it("un accord plus bas que le prix sans voix est redemandé, rien n'est créé", async () => {
    const fichier = await imageDeposee();
    const etat = await ecran.etatDepotImageVideo({ voix: async () => null });
    const issue = await ecran.deposerImageVideo(
      { fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: etat.montantSansVoixCentimes - 1, sansVoix: true },
      { voix: sansVoixDispo },
    );
    expect(issue).toMatchObject({ statut: "accord-requis", centimes: etat.montantSansVoixCentimes });
    expect(await videosIV()).toHaveLength(0);
  });

  it("avec voix mais sans voix prête : toujours refusé (la voix reste exigée)", async () => {
    const fichier = await imageDeposee();
    const issue = await ecran.deposerImageVideo({ fichierId: fichier.id, reseaux: [...RESEAUX_IV], largeur: carte.image.largeur, hauteur: carte.image.hauteur, accordCentimes: 100000 }, { voix: async () => null });
    expect(issue).toMatchObject({ statut: "refusee", phrase: ecran.PHRASES_IV.sansVoix });
  });
});

const TEXTE = "Quand une facture client dépasse 30 jours, l'IA rédige une relance polie, l'envoie par e-mail et suit le paiement dans le tableur.";
const SCRIPT =
  "Vingt-trois heures quatorze. Un client vous écrit. Vous dormez, lui attend. Sauf si quelqu'un lui répond tout de suite. Le chatbot lit la demande, puis la réponse part en quatre secondes. Le ticket se ferme tout seul. Un e-mail propre part à la bonne équipe. Une alerte tombe sur Telegram. Le client est prévenu : réponse sous deux heures. Votre client a toujours une réponse.";
const plafondDe = (v: { entrees?: Record<string, unknown> }) => (v.entrees?.imageVideo as { plafondCentimes?: number }).plafondCentimes;

describe("IV-SV · les modes « Titre ou idée » et « Mon script » : prix sans voix côté serveur", () => {
  it("titre ou idée : le plafond est le prix SANS voix, aucune cloche « accepté sans confirmation »", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const sansVoix = ecran.prixDuDepot(RESEAUX_IV, ecran.TAUX_USD_EUR_PAR_DEFAUT, 50, true);
    const avecVoix = ecran.prixDuDepot(RESEAUX_IV, ecran.TAUX_USD_EUR_PAR_DEFAUT, 50);
    expect(sansVoix).toBeLessThan(avecVoix);
    const issue = await texte.deposerTexteImageVideo({ texte: TEXTE, reseaux: [...RESEAUX_IV], accordCentimes: sansVoix, sansVoix: true }, { voix: sansVoixDispo, taux: async () => ecran.TAUX_USD_EUR_PAR_DEFAUT });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    const [video] = await videosIV();
    expect(plafondDe(video)).toBe(sansVoix);
    expect(video.distribution).toEqual([]);
    expect((await depots().notifications.lister(() => true)).filter((n) => /sans confirmation/.test(n.titre))).toEqual([]);
  });

  it("mon script : le plafond est le prix SANS voix, aucune cloche", async () => {
    await ecrireParametre(ecran.PARAM_ACCORD_ESSAI_IV, true);
    const sansVoix = ecran.prixDuDepot(RESEAUX_IV, ecran.TAUX_USD_EUR_PAR_DEFAUT, Math.max(50, ecran.dureeCibleDuScript(SCRIPT.split(/\s+/).length)), true);
    const issue = await texte.deposerScriptImageVideo({ script: SCRIPT, reseaux: [...RESEAUX_IV], accordCentimes: sansVoix, sansVoix: true }, { voix: sansVoixDispo, taux: async () => ecran.TAUX_USD_EUR_PAR_DEFAUT });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    const [video] = await videosIV();
    expect(plafondDe(video)).toBe(sansVoix);
    expect((await depots().notifications.lister(() => true)).filter((n) => /sans confirmation/.test(n.titre))).toEqual([]);
  });

  it("titre ou idée avec voix mais sans voix prête : refusé ; « oui » (≠ true) n'allume pas le mode", async () => {
    expect(await texte.deposerTexteImageVideo({ texte: TEXTE, reseaux: [...RESEAUX_IV], accordCentimes: 100000 }, { voix: async () => null })).toMatchObject({ statut: "refusee", phrase: ecran.PHRASES_IV.sansVoix });
    expect(await texte.deposerTexteImageVideo({ texte: TEXTE, reseaux: [...RESEAUX_IV], accordCentimes: 100000, sansVoix: "oui" as never }, { voix: async () => null })).toMatchObject({ statut: "refusee", phrase: ecran.PHRASES_IV.sansVoix });
    expect(await videosIV()).toHaveLength(0);
  });
});

describe("IV-SV · gardes assouplies : seul `true` exact les assouplit", () => {
  it("le lot : sansVoix change la clé d'idempotence ; absent, la clé est celle d'avant", () => {
    const sans = lot.cleIdempotenceLotIV(["f1"], ["linkedin"], undefined, 100, true);
    const avec = lot.cleIdempotenceLotIV(["f1"], ["linkedin"], undefined, 100);
    expect(sans).not.toBe(avec);
    expect(lot.cleIdempotenceLotIV(["f1"], ["linkedin"], undefined, 100, false)).toBe(avec);
  });

  it("le lot : sans voix, aucune voix cherchée ; avec voix absente (ou sansVoix ≠ true) : refusé", async () => {
    const f1 = await imageDeposee();
    const f2 = await depots().fichiers.modifier((await imageDeposee()).id, { sha256: "autre-image" });
    const image = (f: { id: string }) => ({ fichierId: f.id, largeur: carte.image.largeur, hauteur: carte.image.hauteur });
    const demande = { images: [image(f1), image(f2)], reseaux: [...RESEAUX_IV], accordCentimes: 100000 };
    expect(await lot.deposerLotImageVideo({ ...demande, sansVoix: "oui" as never }, { voix: async () => null })).toMatchObject({ statut: "refusee", phrase: ecran.PHRASES_IV.sansVoix });
    expect(await lot.deposerLotImageVideo(demande, { voix: async () => null })).toMatchObject({ statut: "refusee", phrase: ecran.PHRASES_IV.sansVoix });
    const issue = await lot.deposerLotImageVideo({ ...demande, sansVoix: true }, { voix: sansVoixDispo });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
  });

  it("DISTRIBUTION_INCOMPLETE reste pour image → vidéo sans `sansVoix` ou avec « oui » ; aucun assouplissement pour un autre format", async () => {
    const { nouveauBrouillonFormat } = await import("@/services/creation-format");
    const { enregistrerScriptDuBrouillon } = await import("@/services/videos");
    const { construireCommande } = await import("@/services/fabrication");
    const codeDe = async (formatId: string, sansVoix: unknown) => {
      const v = await nouveauBrouillonFormat({ formatId, titre: "essai", sujet: "essai", distribution: [], entrees: { imageVideo: { reseaux: ["linkedin"], ...(sansVoix === undefined ? {} : { sansVoix }) } } });
      await enregistrerScriptDuBrouillon(v.id, ecran.BLOCS_SCRIPT_PROVISOIRE_IV(v.id));
      try {
        await construireCommande(v.id);
        return "aucune erreur";
      } catch (e) {
        return (e as { code?: string }).code ?? String(e);
      }
    };
    expect(await codeDe(ID_FORMAT_IMAGE_VIDEO, undefined)).toBe("DISTRIBUTION_INCOMPLETE");
    expect(await codeDe(ID_FORMAT_IMAGE_VIDEO, "oui")).toBe("DISTRIBUTION_INCOMPLETE");
    expect(await codeDe("tutoriel-outil", true)).toBe("DISTRIBUTION_INCOMPLETE");
    expect(await codeDe(ID_FORMAT_IMAGE_VIDEO, true)).not.toBe("DISTRIBUTION_INCOMPLETE");
  });
});
