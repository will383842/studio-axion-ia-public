/**
 * MISSION V — cohérence après les fusions J (confirmation des options payantes), K (effet réaliste par IA) et L
 * (13 modèles dans le monteur), arrivées après la vérification Z :
 *  - le monteur face caméra connaît À LA FOIS les 13 modèles (L), les effets 3D (F3 / I / I2) et l'effet réaliste IA
 *    (K) ; une même réponse de Claude qui mélange les trois est relue sans rien transformer ;
 *  - l'effet réaliste n'est JAMAIS posé par le monteur : il attend la carte de confirmation (J) ;
 *  - tout ce qui est payant reste COUPÉ par défaut ; en réel, sans jeton de confirmation, aucun client payant n'est
 *    rendu (garde serveur) et rien ne part sur le réseau.
 * Dépôts en mémoire, `fetch` interdit, aucun appel réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entreesFacecamVides } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import {
  appliquerOperations,
  catalogueTexte,
  exemplesDemandes,
  exemplesEffets,
  lireReponseMonteur,
  motsPourMonteur,
  reglagesMonteurVides,
  TYPES_OPERATION_FACECAM,
  type OperationFacecam,
} from "@/moteurs/montage-facecam/monteur";
import { MODELES_CARTE } from "@/moteurs/montage-facecam/monteur/operations";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { reglageEffetRealiste } = await import("@/services/effet-realiste-ia");
const { lireReglageDecorIa } = await import("@/services/decor-ia");
const { lireReglageMulticameraFormat } = await import("@/services/multicamera");
const { lireReglageMulticameraAvocat } = await import("@/services/multicamera-avocat");
const { tarifs } = await import("@/services/options-payantes");
const { higgsfieldPourOption } = await import("@/services/options-payantes-higgsfield");
const { TARIFS_PAR_DEFAUT } = await import("@/briques/options-payantes/registre");

const MOTS: MotHorodate[] = Array.from({ length: 60 }, (_, i) => ({ mot: i === 20 ? "téléphone" : `mot${i}`, debutSec: 1 + i * 0.5, finSec: 1.4 + i * 0.5 }));
let n = 0;
const ctx = () => ({ mots: motsPourMonteur(MOTS, []), dureePriseSec: 32, origine: "demande" as const, consigneId: "fil", nouvelId: (p: string) => `${p}-${++n}` });
const etat = () => ({ facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });

const carteCheckList: OperationFacecam = { type: "ajouterCarte", debutMot: 2, finMot: 6, modele: "check-list", textes: ["Devis signé", "Acompte reçu"], html: null, disposition: "ecran-partage", description: "Check-list", animationGardeeId: null };
const objet3D: OperationFacecam = { type: "objetMain", debutMot: 40, finMot: 44, objet: "logo-axion", description: "logo dans ma main" };
const effetIA: OperationFacecam = {
  type: "effetRealisteIA",
  consigne: "Rajoute au bon endroit un téléphone dans ma main et jette-le sur l'écran",
  ancre: "bon-endroit",
  debutMot: 20,
  instantSec: null,
  dureeSec: 5,
  consigneVideo: "A smartphone appears in the man's open palm, he throws it toward the camera.",
  objet: "telephone",
  imageReference: null,
  finitSurEcran: true,
  sonSuggere: "verre",
  raisonMoment: "Will parle du téléphone",
};

describe("mission V · le monteur face caméra connaît L, F3 et K ensemble", () => {
  it("vocabulaire : 13 modèles, 3 effets 3D puis l'effet réaliste IA en fin ; catalogue et « Que puis-je demander ? » cohérents", () => {
    expect(MODELES_CARTE).toHaveLength(13);
    // Test en prod du 11/10 : le titre de couverture (sans montage) vient ensuite, en toute fin.
    expect(TYPES_OPERATION_FACECAM.slice(-5)).toEqual(["objetMain", "vitreBrisee", "transitionEcran", "effetRealisteIA", "changerTitreCouverture"]);
    const texte = catalogueTexte();
    for (const m of ["graphique", "check-list", "titre-plein-ecran", "documentaire"]) expect(texte).toContain(m);
    for (const t of ["objetMain", "vitreBrisee", "transitionEcran", "effetRealisteIA"]) expect(texte).toContain(`- ${t} (`);
    // L : 14 exemples (3 des modèles 7 à 13 insérés, effets 3D en fin) ; K : l'effet payant n'y entre pas sans mention.
    const exemples = exemplesDemandes();
    expect(exemples).toHaveLength(14);
    const mentions = exemplesEffets();
    expect(mentions.some((e) => e.mention === "réaliste, payant")).toBe(true);
    expect(mentions.some((e) => e.mention === "en 3D, gratuit")).toBe(true);
  });

  it("une réponse qui mélange carte 7-13, objet 3D et effet réaliste est relue telle quelle (rien en carte sur mesure)", () => {
    const lu = lireReponseMonteur({ reponse: "C'est prêt.", operations: [carteCheckList, objet3D, effetIA], consignes: [] })!;
    expect(lu.ecartees).toEqual([]);
    expect(lu.operations.map((o) => o.type)).toEqual(["ajouterCarte", "objetMain", "effetRealisteIA"]);
    expect(lu.operations[0]).toMatchObject({ modele: "check-list" });
  });

  it("appliquer : la carte et l'objet 3D sont posés, l'effet réaliste attend la confirmation (jamais posé)", () => {
    const sans = appliquerOperations(etat(), [carteCheckList, objet3D], ctx());
    const avec = appliquerOperations(etat(), [carteCheckList, objet3D, effetIA], ctx());
    expect(sans.aConfirmer).toEqual([]);
    expect(avec.aConfirmer).toHaveLength(1);
    expect(avec.etat.facecam.passages.length).toBe(sans.etat.facecam.passages.length);
    expect(avec.etat.facecam.passages.map((p) => p.type)).toEqual(sans.etat.facecam.passages.map((p) => p.type));
  });
});

describe("mission V · payant coupé par défaut, garde serveur", () => {
  const reseau: string[] = [];
  const ENV_REEL = { HIGGSFIELD_API_KEY: "cle-secrete-essai-123456", HIGGSFIELD_API_URL: "https://higgsfield.exemple" };

  beforeEach(() => {
    reinitialiserDepots();
    reseau.length = 0;
    vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
      reseau.push(String(u));
      throw new Error("réseau interdit");
    }) as typeof fetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("réglages par défaut : effet réaliste simulé, Décor IA coupé, multicaméra coupée (avocat et face caméra), prix du crédit par défaut", async () => {
    expect(await reglageEffetRealiste()).toEqual({ reel: false });
    expect(await lireReglageDecorIa()).toMatchObject({ actif: false, reel: false });
    expect(await lireReglageMulticameraFormat("facecam")).toMatchObject({ actif: false, reel: false });
    expect(await lireReglageMulticameraAvocat()).toMatchObject({ actif: false, reel: false });
    expect((await tarifs()).prixCreditHiggsfieldCentimes).toBe(TARIFS_PAR_DEFAUT.prixCreditHiggsfieldCentimes);
  });

  it("effet réaliste en réel sans jeton : aucun client Higgsfield rendu, aucun appel réseau", async () => {
    for (const optionId of ["effet-realiste-ia", "decor-ia", "effets-main-ultra"] as const) {
      const r = await higgsfieldPourOption(optionId, { travailId: "trav-sans-accord", reel: true, dureeSec: 5, passagesSec: [5] }, ENV_REEL);
      expect(r.statut).not.toBe("pret");
    }
    expect(reseau).toEqual([]);
  });
});
