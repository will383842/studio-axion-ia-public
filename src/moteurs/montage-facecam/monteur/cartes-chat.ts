/**
 * CARTES DU CHAT ET CARTES AUTOMATIQUES (test réel en prod du 10/10). PUR, sans dépôt ni réseau.
 *
 * Une carte demandée au monteur du chat ne fait JAMAIS disparaître une carte automatique sans le dire. Après chaque
 * tour, le pilote replanifie les cartes automatiques comme la chaîne (`cartesAutoDeLaVideo` : mots montés, gestes de
 * Will, cartes du monteur, effets spéciaux) et compare avec la vidéo d'avant :
 *   - instant approximatif (« quand je parle de la formation ») et carte automatique juste avant : la nouvelle carte
 *     passe juste après elle (3 s de décalage au plus) ;
 *   - carte automatique juste après : la nouvelle carte est raccourcie (jamais sous 2 s, 11/10), sinon avancée juste
 *     avant elle (« juste avant la carte de fin ») ;
 *   - carte remise (« remets-la ») : la carte du monteur qui la recouvre lui laisse la place si rien d'autre ne s'efface ;
 *   - carte de FIN (dernière carte automatique) : jamais effacée par une carte ajoutée ; si rien ne tient, la carte
 *     ajoutée n'est pas posée et la réponse demande à Will de choisir (11/10) ;
 *   - sinon la carte automatique s'efface et la réponse le dit (« … s'efface : dites « remets-la » pour la garder »).
 * Un ajustement n'est gardé que s'il efface MOINS de cartes automatiques. La réponse se construit sur ce résultat :
 * une seule affirmation par carte (`recalerReponse`).
 */
import { motsDuMontage } from "@/briques/coupes";
import type { MotHorodate } from "@/domaine/types";
import { ajustementsAuMontage, cartesAutoDeLaVideo, ECART_CARTES_OCCUPEES_SEC, ECART_CARTES_SEC, sansMarqueurs, texteCarteMotion, type CarteAutoVue } from "../cartes-video";
export { sansMarqueurs };
import { corrigerMots } from "../habillage";
import { cartesDesPassages } from "../raccords";
import { gardesDepuisCoupes } from "../retouche";
import type { EtatMonteur, PassageMonteur } from "./appliquer";
import { passageEffetSpecial } from "./effets";
import { coupesActives, dureeMontee, horloge, monteeVersPrise, priseVersMontee } from "./temps";

/** Décalage le plus grand d'une carte à l'instant approximatif (« juste après » / « juste avant » la carte automatique). */
export const DECALAGE_MAX_SEC = 3;
/** Test réel du 11/10 : une carte raccourcie pour laisser sa place reste lisible (2 s au moins). */
export const CARTE_MIN_SEC = 2;
/** Marge au-delà de l'écart minimal (arrondis des temps montés). */
const MARGE_SEC = 0.05;
/** Cartes automatiques de la vidéo telle que la chaîne la poserait pour cet état (posées, retirées, masquées). */
export function planCartesAuto(etat: EtatMonteur, mots: MotHorodate[], dureePriseSec: number): CarteAutoVue[] {
  if (!mots.length || !(dureePriseSec > 0)) return [];
  const coupes = coupesActives(etat.facecam, etat.reglages.coupesDemandees);
  const montes = corrigerMots(motsDuMontage(mots, gardesDepuisCoupes(coupes, dureePriseSec)), etat.reglages.correctionsSousTitres).mots;
  const passages = etat.facecam.passages as PassageMonteur[];
  const occupees = [...cartesDesPassages(passages), ...passages.filter((p) => passageEffetSpecial(p) && p.finSec > p.debutSec)];
  const ajustements = ajustementsAuMontage(etat.reglages.cartesAuto, (s) => priseVersMontee(s, coupes));
  return cartesAutoDeLaVideo(montes, dureeMontee(dureePriseSec, coupes), ajustements, occupees, etat.reglages.cartesAutoRetirees).vues;
}

/** Nom court d'une carte pour Will (« 3 questions ») : le début de son texte, comme dans la liste vue par Claude. */
export const nomCarte = (texte: string | undefined) => sansMarqueurs(texte?.split(" · ")[0] ?? "").trim().slice(0, 60) || "carte";
const nomAuto = (v: CarteAutoVue) => nomCarte(texteCarteMotion(v.carte));

const chevauche = (a: { debutSec: number; finSec: number }, b: { debutSec: number; finSec: number }) => a.debutSec < b.finSec + ECART_CARTES_OCCUPEES_SEC - 1e-6 && a.finSec > b.debutSec - ECART_CARTES_OCCUPEES_SEC + 1e-6;

export interface ContexteCartesChat {
  mots: MotHorodate[];
  dureePriseSec: number;
  /** Vrai si la consigne donne un instant approximatif (pas de « à 0:32 ») : la carte peut glisser un peu. */
  approximatif: (consigneId: string | undefined) => boolean;
  /** Cartes automatiques remises pendant ce tour (identifiants stables). */
  remises: string[];
}

/** Ce que la réponse dit d'une carte, d'après la planification RÉELLE (une seule affirmation par carte). */
export interface PhraseCarte {
  texte: string;
  /** Nom de la carte dont parle la phrase. */
  carte: string;
  /**
   * Vrai : la carte n'est pas là où Claude la croit (effacée, pas remise, pas ajoutée) : ses phrases qui la nomment
   * sont retirées, celle-ci les remplace. Faux : la carte a seulement bougé ; la phrase n'est ajoutée que si Claude
   * ne la nomme pas (sinon son instant est recalé).
   */
  remplace: boolean;
  /** Carte ajoutée PAS posée : la consigne qui la demandait (son résumé devient cette phrase). */
  consigneId?: string;
}

export interface ResultatCartesChat {
  etat: EtatMonteur;
  /** Phrases sur les cartes (déplacées, effacées, impossibles à remettre, pas ajoutées). */
  phrases: PhraseCarte[];
  /** Cartes du monteur déplacées : instant d'avant et nouvel instant (temps monté), pour recaler la réponse. */
  instants: { carte: string; de: number; a: number }[];
}

/**
 * Après un tour : la place des cartes automatiques. `avant` : état de la version d'avant ; `apres` : état après les
 * opérations du tour. Rend l'état ajusté et ce que la réponse doit dire.
 *
 * Test réel du 11/10 : une carte demandée « juste avant » une carte automatique est avancée et/ou raccourcie (2 s
 * au moins) pour ne pas l'effacer ; la carte de FIN (dernière carte automatique, l'appel à l'action) passe en priorité :
 * si rien ne tient, la carte AJOUTÉE n'est pas posée et Will choisit.
 */
export function menagerCartesAuto(avant: EtatMonteur, apres: EtatMonteur, ctx: ContexteCartesChat): ResultatCartesChat {
  const vuesAvant = planCartesAuto(avant, ctx.mots, ctx.dureePriseSec);
  if (!vuesAvant.length) return { etat: apres, phrases: [], instants: [] };
  const poseesAvant = new Set(vuesAvant.filter((v) => v.etat === "posee").map((v) => v.idStable));
  const remises = new Set(ctx.remises);
  /** Carte de fin : la dernière carte automatique de la vidéo (posée, ou remise pendant ce tour). */
  const idFin = vuesAvant.filter((v) => poseesAvant.has(v.idStable) || remises.has(v.idStable)).sort((a, b) => a.debutSec - b.debutSec).at(-1)?.idStable;
  const nouveaux = new Set(apres.facecam.passages.filter((p) => !avant.facecam.passages.some((x) => x.id === p.id)).map((p) => p.id));
  const coupes = coupesActives(apres.facecam, apres.reglages.coupesDemandees);
  const dureeSec = dureeMontee(ctx.dureePriseSec, coupes);
  /** Cartes automatiques qui doivent être là (posées avant, ou remises) et ne le sont pas. */
  const effacees = (etat: EtatMonteur) => {
    const vues = planCartesAuto(etat, ctx.mots, ctx.dureePriseSec);
    const posees = new Set(vues.filter((v) => v.etat === "posee").map((v) => v.idStable));
    const vus = new Set<string>();
    return vues.filter((v) => v.etat === "masquee" && (poseesAvant.has(v.idStable) || remises.has(v.idStable)) && !posees.has(v.idStable) && !vus.has(v.idStable) && vus.add(v.idStable));
  };
  const deplacer = (etat: EtatMonteur, id: string, debutSec: number, finSec: number): EtatMonteur => ({
    ...etat,
    facecam: {
      ...etat.facecam,
      passages: etat.facecam.passages.map((p) => (p.id === id ? { ...p, debutSec: +debutSec.toFixed(3), finSec: +finSec.toFixed(3), ancre: { debutPriseSec: +monteeVersPrise(debutSec, coupes).toFixed(3), finPriseSec: +monteeVersPrise(finSec, coupes).toFixed(3) } } : p)),
    },
  });
  const cartesMonteur = (etat: EtatMonteur) => cartesDesPassages(etat.facecam.passages as PassageMonteur[]);
  const nomPassage = (etat: EtatMonteur, id: string) => nomCarte(etat.facecam.passages.find((p) => p.id === id)?.texte);

  let etat = apres;
  let manquantes = effacees(etat);
  const deplacees = new Map<string, { de: number; pres: string; sens: "avant" | "apres" }>();
  for (let tour = 0; tour < 6 && manquantes.length; tour++) {
    let mieux: { etat: EtatMonteur; manquantes: CarteAutoVue[]; id: string; de: number; pres?: { nom: string; sens: "avant" | "apres" } } | null = null;
    for (const a of manquantes) {
      const remise = remises.has(a.idStable);
      const fin = a.idStable === idFin;
      for (const c of cartesMonteur(etat).filter((x) => (nouveaux.has(x.id) || remise) && chevauche(a, x))) {
        const p = etat.facecam.passages.find((x) => x.id === c.id) as PassageMonteur;
        const duree = p.finSec - p.debutSec;
        // La carte peut bouger : instant approximatif, carte remise, ou carte de fin à protéger.
        const libre = remise || fin || ctx.approximatif(p.consigneId);
        const essais: { debutSec: number; finSec: number; pres?: { nom: string; sens: "avant" | "apres" } }[] = [];
        const apresA = a.finSec + ECART_CARTES_OCCUPEES_SEC + MARGE_SEC;
        const avantA = a.debutSec - ECART_CARTES_OCCUPEES_SEC - MARGE_SEC;
        const juste = (sens: "avant" | "apres") => ({ nom: nomAuto(a), sens });
        if (a.debutSec <= c.debutSec) {
          // Carte automatique juste avant : la nouvelle glisse juste après elle (instant approximatif, ou carte remise).
          if ((remise || (ctx.approximatif(p.consigneId) && apresA - p.debutSec <= DECALAGE_MAX_SEC)) && apresA + duree <= dureeSec) essais.push({ debutSec: apresA, finSec: apresA + duree, pres: juste("apres") });
          // Carte de fin : la nouvelle passe juste avant elle, si ce n'est pas loin.
          if (fin && p.debutSec - (avantA - duree) <= DECALAGE_MAX_SEC && avantA - duree >= 0) essais.push({ debutSec: avantA - duree, finSec: avantA, pres: juste("avant") });
        } else {
          // Carte automatique juste après : la nouvelle est raccourcie (2 s lisibles au moins)…
          if (avantA - p.debutSec >= CARTE_MIN_SEC) essais.push({ debutSec: p.debutSec, finSec: avantA });
          // … sinon avancée juste avant elle (sa durée, puis 2 s), si elle peut bouger…
          for (const d of [duree, Math.min(duree, CARTE_MIN_SEC)]) {
            const debut = avantA - d;
            if (libre && debut >= 0 && debut < p.debutSec && (remise || p.debutSec - debut <= DECALAGE_MAX_SEC)) essais.push({ debutSec: debut, finSec: avantA, pres: juste("avant") });
          }
          // … sinon (carte remise) elle passe après.
          if (remise && apresA + duree <= dureeSec) essais.push({ debutSec: apresA, finSec: apresA + duree, pres: juste("apres") });
        }
        // Jamais sur une autre carte du monteur.
        const autres = cartesMonteur(etat).filter((x) => x.id !== p.id);
        for (const e of essais.filter((x) => !autres.some((o) => x.debutSec < o.finSec + ECART_CARTES_SEC && x.finSec > o.debutSec - ECART_CARTES_SEC))) {
          const suivant = deplacer(etat, p.id, e.debutSec, e.finSec);
          const reste = effacees(suivant);
          if (reste.length < (mieux?.manquantes.length ?? manquantes.length)) mieux = { etat: suivant, manquantes: reste, id: p.id, de: deplacees.get(p.id)?.de ?? p.debutSec, ...(e.pres ? { pres: e.pres } : {}) };
        }
      }
    }
    if (!mieux) break;
    etat = mieux.etat;
    manquantes = mieux.manquantes;
    if (mieux.pres) deplacees.set(mieux.id, { de: mieux.de, pres: mieux.pres.nom, sens: mieux.pres.sens });
  }

  const phrases: PhraseCarte[] = [];
  // Carte de fin toujours effacée par une carte ajoutée à ce tour : la carte ajoutée n'est pas posée, Will choisit.
  const finEffacee = manquantes.find((a) => a.idStable === idFin);
  if (finEffacee) {
    const enTrop = cartesMonteur(etat).filter((x) => nouveaux.has(x.id) && chevauche(finEffacee, x));
    if (enTrop.length) {
      const ids = new Set(enTrop.map((x) => x.id));
      etat = { ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.filter((p) => !ids.has(p.id)) } };
      manquantes = effacees(etat);
      for (const x of enTrop) {
        const nom = nomPassage(apres, x.id);
        deplacees.delete(x.id);
        const consigneId = (apres.facecam.passages.find((p) => p.id === x.id) as PassageMonteur | undefined)?.consigneId;
        phrases.push({ carte: nom, remplace: true, ...(consigneId ? { consigneId } : {}), texte: `Je n'ai pas ajouté la carte « ${nom} » : à ce moment, elle effacerait la carte de fin « ${nomAuto(finEffacee)} ». Dites « remplace la carte de fin » ou donnez-moi un autre moment.` });
      }
    }
  }

  const instants: ResultatCartesChat["instants"] = [];
  for (const [id, d] of deplacees) {
    const p = etat.facecam.passages.find((x) => x.id === id);
    if (!p) continue;
    const nom = nomCarte(p.texte);
    if (horloge(d.de) !== horloge(p.debutSec)) instants.push({ carte: nom, de: d.de, a: p.debutSec });
    phrases.push({ carte: nom, remplace: false, texte: `Carte « ${nom} » placée à ${horloge(p.debutSec)}, juste ${d.sens} la carte « ${d.pres} ».` });
  }
  for (const a of manquantes) {
    const occupe = cartesMonteur(etat).find((x) => chevauche(a, x));
    const nomOccupe = occupe ? nomPassage(etat, occupe.id) : "";
    const qui = occupe ? `la carte « ${nomOccupe} » occupe ce moment` : "un autre élément occupe ce moment";
    phrases.push({
      carte: nomAuto(a),
      remplace: true,
      texte: remises.has(a.idStable) ? `La carte « ${nomAuto(a)} » ne peut pas revenir : ${qui}.${occupe ? ` Dites : retire « ${nomOccupe} ».` : ""}` : `La carte « ${nomAuto(a)} » s'efface : ${qui} ; dites « remets-la » pour la garder.`,
    });
  }
  return { etat, phrases, instants };
}

/** Texte comparable (sans marqueur, sans casse, apostrophes et espaces unifiés). */
const comparable = (t: string) => sansMarqueurs(t).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
/** La phrase nomme cette carte (entre guillemets : « Formation » n'est pas « Une formation pour vos équipes »). */
export const nommeCarte = (phrase: string, carte: string) => carte !== "carte" && new RegExp(`«\\s?${comparable(carte).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(comparable(phrase));
/** Phrases d'un texte (la fin de phrase suivie d'une majuscule ou d'un guillemet). */
export const phrasesDe = (texte: string) => texte.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝÉÈ«"])/).filter((x) => x.trim());

/**
 * Test réel du 11/10 : la réponse de Claude recalée sur la planification RÉELLE. Ses phrases qui nomment une carte
 * dont le sort a changé (effacée, pas remise, pas ajoutée) sont retirées ; dans celles qui nomment une carte déplacée,
 * l'instant qui suit le nom devient le vrai.
 */
export function recalerReponse(texte: string, r: Pick<ResultatCartesChat, "phrases" | "instants">): string {
  // Même longueur que le texte : la position du nom vaut dans les deux.
  const bas = (t: string) => t.toLowerCase().replace(/’/g, "'");
  const retirees = r.phrases.filter((p) => p.remplace).map((p) => p.carte);
  const global = r.instants.reduce((t, x) => t.replace(new RegExp(`(^|[^\\d:])${horloge(x.de)}(?!\\d)`, "g"), `$1${horloge(x.a)}`), sansMarqueurs(texte));
  return phrasesDe(global)
    .filter((ph) => !retirees.some((c) => nommeCarte(ph, c)))
    .map((ph) =>
      r.instants.reduce((s, x) => {
        const i = bas(s).indexOf(bas(x.carte));
        if (i < 0) return s;
        const debut = s.slice(0, i);
        const suite = s.slice(i).replace(/\b(\d{1,2}):(\d{2})\b/, (h, m: string, sec: string) => (Math.abs(Number(m) * 60 + Number(sec) - x.de) <= DECALAGE_MAX_SEC + 1 ? horloge(x.a) : h));
        return debut + suite;
      }, ph),
    )
    .join(" ");
}
