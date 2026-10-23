/**
 * PASSE « DÉCOR IA » D'UNE VIDÉO (lot L10, option désactivée par défaut). Tout ce qui touche au monde extérieur est
 * injecté (fournisseur Higgsfield, extraction des passages, dépôt R2, mesures) : la brique reste testable sans réseau.
 *
 * Place dans le montage : APRÈS la passe image (lot B, cadre déjà traité) et AVANT la réalisation. Déroulé :
 *  1. découpage de la vidéo utile en passages de 10 à 15 s aux pauses de parole ;
 *  2. une consigne (règles de l'essai v2) et UNE image de référence, les mêmes pour tous les passages ;
 *  3. devis de la vidéo ENTIÈRE, contrôlé contre le budget du mois restant (plafond) puis contre le solde Higgsfield :
 *     s'il ne tient pas, rien ne part (aucune dépense) ;
 *  4. passage par passage : envoi, lancement, suivi, téléchargement, dépôt, mesures, contrôle de raccord ;
 *     une panne réessayable a droit à UN nouvel essai, dans la limite du devis avec marge ;
 *  5. TOUT OU RIEN : au premier passage définitivement raté, on s'arrête (plus aucun crédit dépensé) et la vidéo
 *     entière repart sur ses passages d'origine. Une vidéo à moitié retouchée montrerait le décor qui change.
 * La voix reste celle de la prise ; les passages retouchés reviennent à 25 i/s sans changer la vitesse.
 * Ne lève jamais : toute panne devient un repli (règle d'or v4 n° 24, la vidéo est toujours livrée).
 */
import type { LigneCout } from "@/domaine/types";
import { creditsPourPassage, IMAGE_REFERENCE_EXIGEE, type FournisseurHiggsfield, type MediaAEnvoyer, type ModeleHiggsfield, type ResultatEdition } from "@/fournisseurs/higgsfield/types";
import { construireConsigneDecor, type DemandeDecor } from "./consigne";
import { creditsPourVideo, ligneDecor, MARGE_DECOR, tientDansLePlafond } from "./cout";
import { decouperAuxPauses, pausesDepuisMots, type OptionsDecoupage, type Pause, type PassageDecor } from "./decoupage";
import { controlerRaccord, conversionVers25ips, IPS_STUDIO, ZOOM_MAX_APRES_DECOR, type MesuresRaccord, type PlanDecor, type SeuilsRaccord, type VerdictRaccord } from "./raccord";

export interface EntreeDecor {
  idVideo: string;
  /** Durée de la vidéo utile (après les coupes, après la passe image). */
  dureeUtileSec: number;
  /** Mots horodatés sur la ligne de temps de la vidéo utile (ou directement les pauses). */
  mots?: { debutSec: number; finSec: number }[];
  pauses?: Pause[];
  decor: DemandeDecor;
  /** Image de référence du décor : la même pour tous les passages (obligatoire pour Kling). */
  imageReference?: MediaAEnvoyer;
  /** Défaut : Kling 3.0 Omni Edit (même décor partout grâce à l'image de référence). */
  modele?: ModeleHiggsfield;
  /** Budget du mois restant (centimes d'euro), lu par le service (`resumeBudget().restant`). */
  restantDuMoisCentimes: number;
  decoupage?: OptionsDecoupage;
  seuils?: SeuilsRaccord;
}

export interface DependancesDecor {
  higgsfield: FournisseurHiggsfield;
  /** Extrait l'IMAGE SEULE (sans son) de la vidéo utile sur [début, fin], en mp4. `null` : extraction impossible. */
  extrairePassage(passage: PassageDecor): Promise<Uint8Array | null>;
  /** Dépose le passage retouché (après retour à 25 i/s) ; rend sa clé R2. */
  deposerPassage(passage: PassageDecor, octets: Uint8Array, conversion: ReturnType<typeof conversionVers25ips>, effet?: { fonduSec: number; accorderCouleurs: boolean }): Promise<string | null>;
  /** Mesure le passage retouché contre l'original et la voix d'origine (studio-aligneur, `/visages`). */
  mesurer(passage: PassageDecor, fichierCle: string): Promise<MesuresRaccord | null>;
  attendre?(ms: number): Promise<void>;
  /** Nombre maximal de suivis par lancement (défaut 180, soit 15 min à 5 s). */
  suivisMax?: number;
  intervalleSuiviMs?: number;
}

export type RaisonDecor =
  | "consigne-vide"
  | "image-reference-manquante"
  | "video-vide"
  | "plafond"
  | "solde-insuffisant"
  | "solde-illisible"
  | "envoi-impossible"
  | "passage-echoue"
  | "raccord";

export interface SuiviPassage extends PassageDecor {
  etat: "a-faire" | "retouche" | "echec" | "non-lance";
  fichierCle?: string;
  verdict?: VerdictRaccord;
  essais: number;
  creditsDebites: number;
}

export interface ResultatDecor {
  /** `applique` : tous les passages retouchés ; `repli` : lancé puis abandonné ; `non-lance` : aucune dépense. */
  statut: "applique" | "repli" | "non-lance";
  raison?: RaisonDecor;
  /** Phrase simple pour Will, SANS AUCUN MONTANT (format sansPrix). */
  message: string;
  plan: PlanDecor;
  passages: SuiviPassage[];
  modele: ModeleHiggsfield;
  /** Consigne réellement envoyée (journal). */
  consigne?: string;
  creditsEstimes: number;
  creditsDebites: number;
  /** Dépense à enregistrer (réelle), vide si rien n'a été débité. */
  lignes: LigneCout[];
}

export const MESSAGES_DECOR: Record<"applique" | RaisonDecor, string> = {
  applique: "Décor IA appliqué.",
  "consigne-vide": "Décor IA non appliqué : décrivez le décor voulu.",
  "image-reference-manquante": "Décor IA non appliqué : ajoutez l'image du décor.",
  "video-vide": "Décor IA non appliqué : vidéo vide.",
  plafond: "Plafond du mois atteint : la vidéo garde son vrai décor.",
  "solde-insuffisant": "Crédits du décor IA insuffisants : la vidéo garde son vrai décor.",
  "solde-illisible": "Décor IA indisponible pour l'instant : la vidéo garde son vrai décor.",
  "envoi-impossible": "Décor non réussi : la vidéo est livrée avec son vrai décor.",
  "passage-echoue": "Décor non réussi : la vidéo est livrée avec son vrai décor.",
  raccord: "Décor non réussi (lèvres ou visage) : la vidéo est livrée avec son vrai décor.",
};

function planOrigine(passages: PassageDecor[]): PlanDecor {
  return { decorApplique: false, morceaux: passages.map((p) => ({ index: p.index, debutSec: p.debutSec, finSec: p.finSec, source: "origine" })), audio: "origine", ips: IPS_STUDIO };
}

const attendreParDefaut = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function appliquerDecor(entree: EntreeDecor, d: DependancesDecor): Promise<ResultatDecor> {
  const modele = entree.modele ?? "kling_video_edit";
  const simule = d.higgsfield.mode === "simulation";
  const pauses = entree.pauses ?? pausesDepuisMots(entree.mots ?? []);
  const decoupe = decouperAuxPauses(entree.dureeUtileSec, pauses, entree.decoupage);
  const passages: SuiviPassage[] = decoupe.map((p) => ({ ...p, etat: "a-faire", essais: 0, creditsDebites: 0 }));
  const creditsEstimes = creditsPourVideo(modele, decoupe.map((p) => p.dureeSec));
  const consigne = construireConsigneDecor(entree.decor) ?? undefined;
  let creditsDebites = 0;

  const fin = (statut: ResultatDecor["statut"], raison?: RaisonDecor): ResultatDecor => {
    const applique = statut === "applique";
    for (const p of passages) if (!applique && p.etat === "a-faire") p.etat = "non-lance";
    const plan: PlanDecor = applique
      ? {
          decorApplique: true,
          morceaux: passages.map((p) => ({ index: p.index, debutSec: p.debutSec, finSec: p.finSec, source: "decor", fichierCle: p.fichierCle, conversion: conversionVers25ips(p.dureeSec) })),
          audio: "origine",
          ips: IPS_STUDIO,
          zoomMax: ZOOM_MAX_APRES_DECOR,
        }
      : planOrigine(decoupe);
    return {
      statut,
      raison,
      message: MESSAGES_DECOR[raison ?? "applique"],
      plan,
      passages,
      modele,
      consigne,
      creditsEstimes,
      creditsDebites,
      lignes: creditsDebites > 0 ? [ligneDecor(creditsDebites, "reel", simule)] : [],
    };
  };

  // 1-2. Rien ne part sans vidéo, sans consigne, ou sans image de référence quand le modèle l'exige.
  if (!decoupe.length) return fin("non-lance", "video-vide");
  if (!consigne) return fin("non-lance", "consigne-vide");
  if (IMAGE_REFERENCE_EXIGEE[modele] && !entree.imageReference) return fin("non-lance", "image-reference-manquante");

  // 3 à 5 : une exception d'une dépendance injectée devient un repli (la vidéo est toujours livrée).
  try {
    return await derouler();
  } catch {
    for (const p of passages) if (p.etat === "a-faire") p.etat = "echec";
    return fin(creditsDebites > 0 ? "repli" : "non-lance", "passage-echoue");
  }

  async function derouler(): Promise<ResultatDecor> {
    // 3. Devis de la vidéo entière : plafond du mois, puis solde du compte.
    if (!tientDansLePlafond(creditsEstimes, entree.restantDuMoisCentimes)) return fin("non-lance", "plafond");
    const solde = await d.higgsfield.lireSolde();
    if (!solde.ok) return fin("non-lance", solde.erreur.code === "solde-insuffisant" ? "solde-insuffisant" : "solde-illisible");
    if (solde.credits < creditsEstimes * MARGE_DECOR) return fin("non-lance", "solde-insuffisant");
    const budgetCredits = Math.ceil(creditsEstimes * MARGE_DECOR);

    // Une seule image de référence pour toute la vidéo.
    let imageReferenceMediaId: string | undefined;
    if (entree.imageReference) {
      const envoi = await d.higgsfield.envoyerMedia(entree.imageReference);
      if (!envoi.ok) return fin("non-lance", "envoi-impossible");
      imageReferenceMediaId = envoi.mediaId;
    }

    const attendre = d.attendre ?? attendreParDefaut;
    const suivisMax = d.suivisMax ?? 180;
    const intervalle = d.intervalleSuiviMs ?? 5000;

    /** Un essai complet d'un passage : rend le résultat, ou l'échec (réessayable ou non). */
    async function essayer(p: SuiviPassage, videoMediaId: string): Promise<{ ok: true; resultat: ResultatEdition } | { ok: false; reessayable: boolean }> {
      p.essais += 1;
      const lance = await d.higgsfield.lancer({ modele, videoMediaId, consigne: consigne!, imageReferenceMediaId, dureeSec: p.dureeSec, idempotence: `${entree.idVideo}-decor-${p.index}-${p.essais}` });
      if (!lance.ok) return { ok: false, reessayable: lance.erreur.reessayable };
      for (let i = 0; i < suivisMax; i++) {
        const etat = await d.higgsfield.suivre(lance.idTravail);
        if (etat.statut === "termine") {
          const debites = etat.resultat.creditsDebites ?? creditsPourPassage(modele, p.dureeSec);
          p.creditsDebites += debites;
          creditsDebites += debites;
          return { ok: true, resultat: etat.resultat };
        }
        if (etat.statut === "echec") {
          p.creditsDebites += etat.creditsDebites ?? 0;
          creditsDebites += etat.creditsDebites ?? 0;
          return { ok: false, reessayable: etat.erreur.reessayable };
        }
        await attendre(intervalle);
      }
      // Trop long : le travail tourne peut-être encore chez Higgsfield. Pas de nouvel essai (pas de double dépense).
      return { ok: false, reessayable: false };
    }

    // 4-5. Passage par passage, tout ou rien.
    for (const p of passages) {
      const octets = await d.extrairePassage(p);
      if (!octets) {
        p.etat = "echec";
        return fin("repli", "envoi-impossible");
      }
      const envoi = await d.higgsfield.envoyerMedia({ nom: `${entree.idVideo}-passage-${p.index}.mp4`, type: "video/mp4", octets });
      if (!envoi.ok) {
        p.etat = "echec";
        return fin(creditsDebites > 0 ? "repli" : "non-lance", "envoi-impossible");
      }
      let essai = await essayer(p, envoi.mediaId);
      const resteDevis = creditsPourVideo(modele, passages.filter((x) => x.index > p.index).map((x) => x.dureeSec));
      if (!essai.ok && essai.reessayable && creditsDebites + creditsPourPassage(modele, p.dureeSec) + resteDevis <= budgetCredits) essai = await essayer(p, envoi.mediaId);
      if (!essai.ok) {
        p.etat = "echec";
        return fin("repli", "passage-echoue");
      }
      const telecharge = await d.higgsfield.telecharger(essai.resultat.url);
      const conversion = conversionVers25ips(p.dureeSec);
      const cle = telecharge.ok ? await d.deposerPassage(p, telecharge.octets, conversion) : null;
      if (!cle) {
        p.etat = "echec";
        return fin("repli", "passage-echoue");
      }
      p.fichierCle = cle;
      p.verdict = controlerRaccord({ dureeSourceSec: p.dureeSec, dureeSortieSec: essai.resultat.dureeSec, mesures: await d.mesurer(p, cle) }, entree.seuils);
      if (!p.verdict.ok) {
        p.etat = "echec";
        return fin("repli", "raccord");
      }
      p.etat = "retouche";
    }
    return fin("applique");
  }
}
