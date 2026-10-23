/**
 * CALAGE DES MOTS SUR LE SON — logique PURE (brique commune `calage` depuis la mission H ; née au moteur avocat, posée
 * par l'architecte le 02/10, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md` ; affinée par D3 sans changer les signatures).
 *
 * Où : `index.ts` (voix), entre la lecture de la voix et le nettoyage des blancs — phases `a-aligner` puis
 * `alignement`, SEULEMENT quand le fournisseur « alignement » est réel (la simulation saute le calage : démonstration
 * M4 et tests identiques). Les mots calés remplacent ceux de la voix AVANT le nettoyage ; `report.ts` les reporte
 * ensuite sur le texte validé (sous-titres au mot près). Un aligneur absent, en panne ou incohérent ne bloque JAMAIS
 * une vidéo : l'horodatage de la voix est gardé, et le rapport le dit (`source: "voix"`).
 *
 * Garde-fous (`verifierAlignement`) :
 *  - mêmes mots : les lettres de la voix doivent se retrouver, dans l'ordre, dans celles du calage (≥ 90 %) — la voix
 *    et l'aligneur peuvent découper autrement (« 135 € » : HeyGen rend « 135 », l'aligneur « 135 » et « € ») ; le
 *    temps est alors reporté lettre à lettre par `horodaterMotsPrononces` (la machine de `report.ts`, non dupliquée) ;
 *  - mots dans l'ordre et dans la durée du son (au plus 10 % de mots remis dans l'ordre, sinon refus) ;
 *  - un mot non aligné (sans lettre reconnue) prend l'horodatage voisin ; au-delà de 40 % de mots non alignés : refus ;
 *  - un calage éloigné de plus de 1,5 s en moyenne de la voix porte sur un autre son : refus.
 */
import type { AlerteQualite, CauseApproximation, CommandeFabrication, MotHorodate, RapportAlignement } from "@/domaine/types";
import type { DemandeAlignement, ResultatAlignement } from "@/fournisseurs/types";
import { ecartMoyenMs, horodaterMotsPrononces, normaliser } from "./report";

/* ------------------------------------------------------------------ */
/* Lot R6 : QUI est calé (constats C5 et C6)                            */
/* ------------------------------------------------------------------ */

/**
 * Faut-il caler la VOIX DE SYNTHÈSE ? Mesure D3 (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md`, annexe D3) : la voix HeyGen
 * telle quelle est plus juste (20,3 ms d'écart moyen) qu'après calage (39,1 ms). Elle n'est donc calée que sur demande
 * (réglage `alignement.voixSynthese`, coupé par défaut), ou quand elle ne donne pas l'horodatage de ses mots (on n'a
 * alors qu'une estimation). Les PRISES FILMÉES, elles, sont toujours calées quand l'aligneur est relié.
 */
export function calerLaVoix(o: { aligneurReel: boolean; voixSynthese: boolean; motsEstimes: boolean }): boolean {
  return o.aligneurReel && (o.voixSynthese || o.motsEstimes);
}

/** Réglages du calage figés dans la commande au lancement (`services/fabrication.ts`). */
export function optionsCalage(c: Pick<CommandeFabrication, "entrees">): { fournisseur?: string; voixSynthese: boolean } {
  const f = c.entrees?.fournisseurAlignement;
  return { ...(typeof f === "string" && f ? { fournisseur: f } : {}), voixSynthese: c.entrees?.calerVoixSynthese === true };
}

/**
 * SEULE règle : des mots estimés (voix sans horodatage, ou prise filmée) restent-ils approximatifs, et pourquoi ?
 * `rapport` : résultat du calage, s'il a été tenté. `undefined` : les mots suivent le son. Décidée UNE fois, puis
 * gardée dans l'état (jamais recalculée à la reprise).
 * Correcteur R6 (relecture exactitude n° 1) : seul un aligneur RÉEL cale. Retiré ou plus inscrit pendant le calage, la
 * simulation renvoie l'estimation telle quelle : ce n'est pas un calage, la cause est « non relié » (Will peut la corriger).
 */
export function causeApproximation(o: { motsEstimes: boolean; aligneurReel: boolean; rapport?: RapportAlignement }): CauseApproximation | undefined {
  if (!o.motsEstimes) return undefined;
  if (!o.aligneurReel) return "non-relie";
  return o.rapport?.source === "aligneur" ? undefined : "echec";
}

/** Alerte visible sur la vidéo (carte Qualité) quand les mots n'ont pas été calés sur le son. */
export function alerteSousTitresApproximatifs(cause: CauseApproximation): AlerteQualite {
  return {
    code: "synchronisation",
    gravite: "attention",
    message:
      cause === "non-relie"
        ? "Sous-titres approximatifs : ils suivent le rythme moyen de la lecture, pas votre voix. Reliez le calage des sous-titres (Réglages > Connexions)."
        : "Sous-titres approximatifs : le calage sur votre voix n'a pas abouti ; ils suivent le rythme moyen de la lecture.",
  };
}

/** Essais du conteneur avant de garder l'horodatage de la voix. */
export const ESSAIS_ALIGNEMENT = 3;

/** Seuils des garde-fous. */
export const GARDE_FOUS_ALIGNEMENT = {
  /** Part minimale des lettres de la voix retrouvées dans le calage. */
  couvertureMin: 0.9,
  /** Part maximale de mots non alignés par l'aligneur. */
  nonAlignesMax: 0.4,
  /** Part maximale de mots remis dans l'ordre. */
  desordreMax: 0.1,
  /** Écart moyen maximal avec la voix (s) : au-delà, le calage porte sur un autre son. */
  ecartMoyenMaxSec: 1.5,
  /** Durée minimale d'un mot calé (s). */
  dureeMotMinSec: 0.02,
} as const;

/** Identifiant stable d'une demande (idempotent ; `-eN` pour un nouvel essai). */
export function idAlignement(idBase: string, essai = 0): string {
  return essai ? `${idBase}-alignement-e${essai}` : `${idBase}-alignement`;
}

export function demandeAlignement(entree: { idBase: string; essai?: number; audio: string; texte: string; reference: MotHorodate[] }): DemandeAlignement {
  return { idAlignement: idAlignement(entree.idBase, entree.essai), audio: entree.audio, texte: entree.texte, langue: "fr", reference: entree.reference };
}

/** Part des lettres de `a` retrouvées dans l'ordre dans `b` (sous-suite gloutonne, avec retour si une lettre manque). */
export function couvertureLettres(a: string[], b: string[]): number {
  const x = a.map(normaliser).join("");
  const y = b.map(normaliser).join("");
  if (!x.length) return 1;
  let j = 0;
  let trouvees = 0;
  for (const c of x) {
    // Une lettre absente de la suite (fenêtre de 12) est sautée sans faire avancer `b` (évite de tout perdre sur un ajout).
    const k = y.indexOf(c, j);
    if (k >= 0 && k - j <= 12) {
      trouvees++;
      j = k + 1;
    }
  }
  return trouvees / x.length;
}

/** Mots du calage dont l'horodatage est inutilisable (marqués non alignés, ou temps impossibles) : pris aux voisins. */
function combler(mots: MotHorodate[], dureeSec: number): { mots: MotHorodate[]; combles: number } {
  const ok = mots.map((m) => (m as { aligne?: boolean }).aligne !== false && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec) && m.finSec >= m.debutSec && m.debutSec >= 0 && m.debutSec <= dureeSec + 0.05);
  let combles = 0;
  const sortie = mots.map((m, i) => {
    if (ok[i]) return { mot: m.mot, debutSec: m.debutSec, finSec: m.finSec };
    combles++;
    let avant = 0;
    for (let k = i - 1; k >= 0; k--) if (ok[k]) { avant = mots[k].finSec; break; }
    let apres = avant;
    for (let k = i + 1; k < mots.length; k++) if (ok[k]) { apres = mots[k].debutSec; break; }
    return { mot: m.mot, debutSec: avant, finSec: Math.max(avant, apres) };
  });
  return { mots: sortie, combles };
}

/** Motif de refus d'un calage, ou `null` s'il est utilisable. */
export function verifierAlignement(voix: MotHorodate[], resultat: ResultatAlignement, dureeSec: number): string | null {
  const g = GARDE_FOUS_ALIGNEMENT;
  if (!voix.length) return "aucun mot";
  if (!resultat.mots.length) return "calage vide";
  if (couvertureLettres(voix.map((m) => m.mot), resultat.mots.map((m) => m.mot)) < g.couvertureMin) return "mots différents";
  const nonAlignes = Math.max(resultat.motsNonAlignes, resultat.mots.filter((m) => (m as { aligne?: boolean }).aligne === false).length);
  if (nonAlignes > g.nonAlignesMax * resultat.mots.length) return "trop de mots non alignés";
  const dehors = resultat.mots.filter((m) => !(m.debutSec >= -0.05 && m.debutSec <= dureeSec + 0.25)).length;
  if (dehors > g.nonAlignesMax * resultat.mots.length) return "mots hors du son";
  return null;
}

/**
 * Mots retenus après le calage : un mot par mot de la voix (même nombre, même texte), horodatés par l'aligneur ; sinon
 * l'horodatage de la voix est gardé (`source: "voix"`).
 */
export function appliquerAlignement(voix: MotHorodate[], resultat: ResultatAlignement | null, dureeSec: number): { mots: MotHorodate[]; rapport: RapportAlignement } {
  const garder = () => ({ mots: voix, rapport: { source: "voix" as const, motsNonAlignes: voix.length } });
  if (!resultat || verifierAlignement(voix, resultat, dureeSec)) return garder();
  const g = GARDE_FOUS_ALIGNEMENT;

  // 1. Mots non alignés : horodatage voisin ; 2. report lettre à lettre sur les mots de la voix (découpages différents).
  const { mots: combles } = combler(resultat.mots, dureeSec);
  const reportes = horodaterMotsPrononces(
    voix.map((m) => m.mot),
    combles,
  );

  // 3. Dans l'ordre et dans la durée.
  let desordre = 0;
  let precedent = 0;
  const mots = reportes.map((m, i) => {
    let debut = Math.max(0, Math.min(dureeSec, m.debutSec));
    if (debut < precedent) {
      desordre++;
      debut = precedent;
    }
    const fin = Math.max(debut + Math.min(g.dureeMotMinSec, Math.max(0, dureeSec - debut)), Math.min(dureeSec, m.finSec));
    precedent = debut;
    return { ...voix[i], debutSec: +debut.toFixed(3), finSec: +fin.toFixed(3) };
  });
  if (desordre > g.desordreMax * voix.length) return garder();

  // 4. Un calage très loin de la voix porte sur un autre son.
  const ecarts = mots.map((m, i) => Math.abs(m.debutSec - voix[i].debutSec) * 1000);
  const moyenne = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
  if (moyenne > g.ecartMoyenMaxSec * 1000) return garder();

  return {
    mots,
    rapport: {
      source: "aligneur",
      modele: resultat.modele,
      ecartMoyenMs: Math.round(resultat.ecartMoyenMs ?? ecartMoyenMs(voix, mots)),
      ecartMaxMs: Math.round(resultat.ecartMaxMs ?? Math.max(0, ...ecarts)),
      motsNonAlignes: resultat.motsNonAlignes,
      dureeCalculSec: resultat.dureeCalculSec,
    },
  };
}
