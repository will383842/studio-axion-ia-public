/**
 * LOT A2 (M5) — illustrations réelles : une règle = un test. Sans réseau, sans clé.
 * Domaine (`domaine/illustrations.ts`) : mots, requêtes, interdits, score, anti-répétition, cascade, banques, coûts.
 * Moteur (`moteurs/montage-avocat/fabrication-illustrations.ts`) : fabrication par étapes, plafond, reprise, éléments créés.
 */
import { describe, expect, it } from "vitest";
import {
  choisirDansLaBibliotheque,
  contientInterdit,
  disponiblePourVideo,
  ECART_ANTI_REPETITION,
  estGenerique,
  motsAnglais,
  motsProches,
  motsSignificatifs,
  pertinent,
  prixFabricationUsd,
  requeteDuPlan,
  requeteFabrication,
  resultatBanqueAcceptable,
  resumeCoutIllustrations,
  scoreCorrespondance,
  SEUIL_CORRESPONDANCE,
  usageApres,
  utilisableParLeMoteur,
  type ElementCascade,
} from "@/domaine/illustrations";
import type { CommandeFabrication, PlanCommande } from "@/domaine/types";
import type { FournisseurIllustration } from "@/fournisseurs/types";
import type { DemandeFabrication, FabricationParEtapes } from "@/fournisseurs/illustration/types";
import { fournisseurIllustrationSimulation } from "@/fournisseurs/simulation/autres";
import { centimes } from "@/lib/montants";
import {
  avancerIllustrations,
  avecIllustrationsFabriquees,
  coutReelCentimes,
  elementsCrees,
  etatInitial,
  fini,
  ligneEstimeeFabrication,
  ligneReelle,
  plansAFabriquer,
} from "@/moteurs/montage-avocat/fabrication-illustrations";
import type { PlanProduit } from "@/moteurs/types";

const el = (id: string, extra: Partial<ElementCascade> = {}): ElementCascade => ({
  id,
  type: "illustration-image",
  nom: id,
  motsCles: [],
  licence: { type: "libre", usageCommercial: true, reseaux: [] },
  ...extra,
});

describe("mots et requêtes (sans Claude : règles locales)", () => {
  it("mots significatifs : sans accents, sans mots vides, pluriel simple ; « PV » gardé", () => {
    expect(motsSignificatifs("Les contraventions sur une table")).toEqual(["contravention", "table"]);
    expect(motsSignificatifs("Un PV de 135 €")).toEqual(["pv", "135"]);
  });

  it("deux mots proches : même racine longue, jamais « table » / « tableau »", () => {
    expect(motsProches("contester", "contestation")).toBe(true);
    expect(motsProches("table", "tableau")).toBe(false);
    expect(motsProches("park", "parking")).toBe(false);
  });

  it("traduction locale français → anglais pour les banques", () => {
    expect(motsAnglais("une facture et un contrat")).toEqual(["invoice", "contract"]);
    expect(requeteDuPlan({ id: "p", ordre: 1, texte: "Vous recevez un PV ?" }).requeteEn).toBe("parking ticket");
  });

  it("la requête suit l'intention du script, et le mot ancre passe en tête", () => {
    const r = requeteDuPlan({ id: "p", ordre: 1, texte: "Une phrase sans rapport.", requete: "un contrat sur une table", motAncre: "table" });
    expect(r.motsFr[0]).toBe("table");
    expect(r.requeteEn.split(" ")[0]).toBe("table");
  });
});

describe("refus : images génériques, personnes, logos, uniformes", () => {
  it("une description seulement générique est refusée (bureau vide, technologie abstraite)", () => {
    expect(estGenerique("abstract technology background")).toBe(true);
    expect(estGenerique("parking ticket on a car")).toBe(false);
  });

  it("fabrication : les personnes, logos et uniformes sont retirés de la requête ; sans objet, rien n'est fabriqué", () => {
    const r = requeteFabrication("police officer writing parking ticket logo");
    expect(r).toMatch(/^writing parking ticket, realistic/);
    expect(r).toMatch(/no people/);
    expect(requeteFabrication("man woman logo")).toBeNull();
    expect(requeteFabrication("")).toBeNull();
    expect(contientInterdit("un avocat en uniforme")).toBe(true);
    expect(contientInterdit("un contrat sur une table")).toBe(false);
  });
});

describe("score de correspondance (seuil, ancre, générique)", () => {
  const req = requeteDuPlan({ id: "p", ordre: 1, texte: "", requete: "un contrat sur une table", motAncre: "contrat" });
  it("tous les mots retrouvés : 1 ; aucun : 0", () => {
    expect(scoreCorrespondance(req, { nom: "Contrat sur une table", motsCles: ["contrat"] })).toBe(1);
    expect(scoreCorrespondance(req, { nom: "Ville la nuit", motsCles: ["ville"] })).toBe(0);
  });
  it("les mots-clés anglais comptent aussi", () => {
    expect(scoreCorrespondance(req, { nom: "x", motsCles: [], motsClesEn: ["contract", "table"] })).toBeGreaterThanOrEqual(SEUIL_CORRESPONDANCE);
  });
  it("une description générique divise le score par deux", () => {
    const plein = scoreCorrespondance(req, { nom: "contrat", motsCles: ["table"] });
    const generique = scoreCorrespondance(req, { nom: "contrat", motsCles: ["table"], description: "abstract business background" });
    expect(generique).toBeCloseTo(plein / 2, 2);
  });
});

describe("anti-répétition : jamais deux vidéos à moins de 10 vidéos d'écart", () => {
  it("disponible : jamais servi, même vidéo, ou 10 vidéos d'écart", () => {
    expect(disponiblePourVideo({}, "v2", 3)).toBe(true);
    expect(disponiblePourVideo({ derniereVideoId: "v1", dernierRangVideo: 3 }, "v1", 3)).toBe(true);
    expect(disponiblePourVideo({ derniereVideoId: "v1", dernierRangVideo: 3 }, "v2", 3 + ECART_ANTI_REPETITION - 1)).toBe(false);
    expect(disponiblePourVideo({ derniereVideoId: "v1", dernierRangVideo: 3 }, "v2", 3 + ECART_ANTI_REPETITION)).toBe(true);
  });
  it("une même vidéo ne compte qu'une utilisation", () => {
    const a = usageApres({ utilisations: 2, derniereVideoId: "v1" }, "v1", 5);
    expect(a.utilisations).toBe(2);
    expect(usageApres(a, "v2", 6)).toEqual({ utilisations: 3, derniereVideoId: "v2", dernierRangVideo: 6 });
  });
});

describe("cascade : Mes images d'abord, puis réutilisation (0 €)", () => {
  const req = requeteDuPlan({ id: "p", ordre: 1, texte: "", requete: "la console de suivi du budget" });
  const ctx = { videoId: "v9", rang: 20, dejaPris: new Set<string>() };
  const perso = el("perso", { origine: "personnelle", motsCles: ["console", "budget"], confidentialite: { statut: "prete", zones: [] } });
  const reuse = el("reuse", { motsCles: ["console", "budget", "suivi"], fabrique: true, origine: "fabriquee" });

  it("une image de Will PRÊTE passe avant une illustration déjà payée, même mieux notée", () => {
    expect(choisirDansLaBibliotheque(req, [reuse, perso], ctx)).toMatchObject({ origine: "mes-images", elementId: "perso" });
  });
  it("une image de Will « à vérifier » n'est jamais utilisée", () => {
    const aVerifier = { ...perso, confidentialite: { statut: "a_verifier" as const, zones: [] } };
    expect(utilisableParLeMoteur(aVerifier)).toBe(false);
    expect(choisirDansLaBibliotheque(req, [aVerifier, reuse], ctx)).toMatchObject({ origine: "reutilisee", elementId: "reuse" });
  });
  it("licence « à vérifier », élément rangé, déjà pris ou trop récent : écartés", () => {
    expect(choisirDansLaBibliotheque(req, [{ ...reuse, licence: { type: "a-verifier", usageCommercial: false, reseaux: [] } }], ctx)).toBeNull();
    expect(choisirDansLaBibliotheque(req, [{ ...reuse, archiveLe: "2026-10-01" }], ctx)).toBeNull();
    expect(choisirDansLaBibliotheque(req, [reuse], { ...ctx, dejaPris: new Set(["reuse"]) })).toBeNull();
    expect(choisirDansLaBibliotheque(req, [{ ...reuse, derniereVideoId: "v8", dernierRangVideo: 15 }], ctx)).toBeNull();
  });
  it("sous le seuil : rien (on cherche plus loin)", () => {
    expect(choisirDansLaBibliotheque(req, [el("x", { motsCles: ["ville"] })], ctx)).toBeNull();
  });
});

describe("banques : vertical seulement, durée, licence, sans texte, pertinent", () => {
  const ok = { largeur: 1080, hauteur: 1920, dureeSec: 8, description: "parking ticket on a windshield", licence: { usageCommercial: true } };
  it("accepté", () => expect(resultatBanqueAcceptable(ok, "9:16", 3, "parking ticket")).toBe(true));
  it("16:9 ou carré : jamais recadré, refusé", () => {
    expect(resultatBanqueAcceptable({ ...ok, largeur: 1920, hauteur: 1080 }, "9:16", 3)).toBe(false);
    expect(resultatBanqueAcceptable({ ...ok, largeur: 1080, hauteur: 1350 }, "9:16", 3)).toBe(false);
    expect(resultatBanqueAcceptable({ ...ok, largeur: 1080, hauteur: 1350 }, "4:5", 3)).toBe(true);
  });
  it("trop court, sans usage commercial, texte ou logo : refusé", () => {
    expect(resultatBanqueAcceptable({ ...ok, dureeSec: 2 }, "9:16", 3)).toBe(false);
    expect(resultatBanqueAcceptable({ ...ok, licence: { usageCommercial: false } }, "9:16", 3)).toBe(false);
    expect(resultatBanqueAcceptable({ ...ok, description: "neon text sign" }, "9:16", 3)).toBe(false);
  });
  it("sans rapport avec la requête (« un homme devant une machine » pour « parking ticket ») : refusé", () => {
    expect(pertinent("a man in front of a machine", "parking ticket")).toBe(false);
    expect(pertinent("coffee bread breakfast table", "contract table")).toBe(false);
    expect(pertinent("a gavel and a document on a table", "gavel law book")).toBe(true);
  });
});

describe("coûts affichés à l'Aperçu : réutilisé 0 € / à fabriquer", () => {
  it("prix d'une illustration fabriquée : image 3,9 ¢ + clip 5 s 10,8 ¢ (dollars)", () => {
    expect(prixFabricationUsd()).toBeCloseTo(14.7, 1);
  });
  it("le mode économique ne fabrique rien", () => {
    const d = [
      { planId: "a", origine: "mes-images" as const },
      { planId: "b", origine: "reutilisee" as const },
      { planId: "c", origine: "banque" as const },
      { planId: "d", origine: "a-fabriquer" as const },
    ];
    expect(resumeCoutIllustrations(d, 0.9, false)).toEqual({ mesImages: 1, reutilisees: 1, banques: 1, aFabriquer: 1, centimesAFabriquer: 13 });
    expect(resumeCoutIllustrations(d, 0.9, true).aFabriquer).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* Moteur : fabrication par étapes                                      */
/* ------------------------------------------------------------------ */

const planIllu = (ordre: number, extra: Partial<PlanCommande> = {}): PlanCommande => ({
  id: `p${ordre}`,
  ordre,
  debutSec: ordre * 3,
  finSec: ordre * 3 + 2,
  texte: "Gardez l'accusé de réception.",
  sourceImage: "illustration",
  illustration: { source: "generee-ia", requete: "un accusé de réception de lettre recommandée", verrouille: false, candidats: [] },
  ...extra,
});
const produit = (p: PlanCommande): PlanProduit => ({ ...p, segmentId: `s${p.ordre}`, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1 }, transition: "coupe" }) as PlanProduit;
const commande = (plans: PlanCommande[], extra: Partial<CommandeFabrication> = {}) =>
  ({ plans, briques: { illustrations: true, "sous-titres": true, etalonnage: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false }, entrees: {}, tauxUsdEur: 0.9, medias: {}, ...extra }) as unknown as CommandeFabrication;

/** Fournisseur par étapes enregistré (aucun réseau) : chaque demande répond « en cours » une fois, puis « fait ». */
function fournisseurParEtapes(options: { echouer?: number } = {}) {
  const soumis: DemandeFabrication[] = [];
  const tours = new Map<string, number>();
  let echecs = options.echouer ?? 0;
  const fabrication: FabricationParEtapes = {
    async soumettre(d) {
      if (echecs > 0) {
        echecs--;
        throw { erreur: { code: "indisponible", reessayable: true, message: "panne passagère" } };
      }
      soumis.push(d);
      return { idDemande: `${d.genre}-${soumis.length}` };
    },
    async suivre(id) {
      const n = (tours.get(id) ?? 0) + 1;
      tours.set(id, n);
      if (n < 2) return { statut: "en_cours" };
      const image = id.startsWith("image");
      return { statut: "fait", fichierCle: `studio/dev/illustrations/fal/${id}.${image ? "jpg" : "mp4"}`, mime: image ? "image/jpeg" : "video/mp4", urlSource: `https://fal.media/${id}`, cout: centimes(image ? 4 : 10), coutUsdCentimes: image ? 3.9 : 10.8, modele: image ? "nano-banana" : "seedance" };
    },
  };
  const f = { ...fournisseurIllustrationSimulation, id: "reel", mode: "reel" as const, fabrication } as FournisseurIllustration;
  return { f, soumis };
}

describe("moteur : illustrations à fabriquer (fal.ai), par étapes", () => {
  it("seuls les plans « à fabriquer » sans élément ; mode économique : aucun ; ligne estimée en euros", () => {
    const c = commande([planIllu(1), planIllu(2, { illustration: { source: "bibliotheque", elementId: "e1", verrouille: false, candidats: [] } }), planIllu(3, { sourceImage: "double" })]);
    expect(plansAFabriquer(c).map((p) => p.ordre)).toEqual([1]);
    expect(ligneEstimeeFabrication(c)).toMatchObject({ etape: "Illustrations à fabriquer", fournisseur: "fal.ai", quantite: 1, total: { centimes: 13 } });
    expect(plansAFabriquer(commande([planIllu(1)], { entrees: { illustrationsEconomique: true } }))).toEqual([]);
    expect(ligneEstimeeFabrication(commande([]))).toBeNull();
  });

  it("jamais plus que l'estimation : un plan de plus après le découpage n'est pas fabriqué", () => {
    const c = commande([planIllu(1)]);
    const etat = etatInitial(c, [produit(planIllu(1)), produit(planIllu(2))]);
    expect(Object.keys(etat.plans)).toEqual(["1"]);
  });

  it("image puis clip, sans attente ; la demande en cours est gardée (reprise sans repayer) ; coût réel relevé", async () => {
    const { f, soumis } = fournisseurParEtapes();
    const c = commande([planIllu(1)]);
    let etat = etatInitial(c, [produit(planIllu(1))]);
    for (let i = 0; i < 6 && !fini(etat); i++) etat = await avancerIllustrations(JSON.parse(JSON.stringify(etat)), f, "9:16", "t1");
    expect(fini(etat)).toBe(true);
    expect(soumis.map((d) => d.genre)).toEqual(["image", "clip"]);
    expect(soumis[0].requete).toMatch(/no people/);
    expect(soumis[1]).toMatchObject({ genre: "clip", imageUrl: "https://fal.media/image-1", dureeSec: 5 });
    expect(coutReelCentimes(etat)).toBe(14);
    expect(ligneReelle(etat)[0]).toMatchObject({ etape: "Illustrations fabriquées", nature: "reel", total: { centimes: 14 } });
  });

  it("panne passagère : nouvel essai ; au-delà de 3, le plan revient au double (la vidéo n'échoue pas)", async () => {
    const { f } = fournisseurParEtapes({ echouer: 1 });
    const c = commande([planIllu(1)]);
    let etat = etatInitial(c, [produit(planIllu(1))]);
    etat = await avancerIllustrations(etat, f, "9:16", "t");
    expect(etat.plans["1"]).toMatchObject({ phase: "image", essais: 1 });
    const enPanne = fournisseurParEtapes({ echouer: 9 }).f;
    let e2 = etatInitial(c, [produit(planIllu(1))]);
    for (let i = 0; i < 4; i++) e2 = await avancerIllustrations(e2, enPanne, "9:16", "t");
    expect(e2.plans["1"].phase).toBe("abandon");
  });

  it("l'élément créé : clip + image en vignette, licence « créée par l'IA », origine fabriquée ; le montage lit le clip", async () => {
    const { f } = fournisseurParEtapes();
    const c = commande([planIllu(1)]);
    const plans = [produit(planIllu(1))];
    let etat = etatInitial(c, plans);
    for (let i = 0; i < 6 && !fini(etat); i++) etat = await avancerIllustrations(etat, f, "9:16", "t");
    const [e] = elementsCrees(plans, etat);
    expect(e).toMatchObject({ type: "illustration-video", origine: "fabriquee", fabrique: true, planOrdre: 1, licence: { type: "generee-ia", usageCommercial: true } });
    expect(e.fichierCle).toMatch(/\.mp4$/);
    expect(e.vignetteCle).toMatch(/\.jpg$/);
    const avec = avecIllustrationsFabriquees(c, plans, etat);
    expect(avec.plans[0].illustration?.elementId).toBe("fab-1");
    expect(avec.commande.medias?.["fab-1"]).toMatchObject({ mime: "video/mp4" });
  });
});
