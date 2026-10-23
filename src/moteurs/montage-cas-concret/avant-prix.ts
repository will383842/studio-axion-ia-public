/**
 * REFUS AVANT LE PRIX (tâche X7). PUR.
 *
 * Tout ce que la fabrication refuserait SANS appel payant est calculé ici, par UNE fonction, appelée :
 *  - par la feuille « Votre vidéo » (via `estimerCas`), avant d'afficher le prix et d'activer « Fabriquer » ;
 *  - par le lancement (`preparerEtLancer`), avant de créer quoi que ce soit ;
 *  - par le moteur (`refusAuLancement`), avant toute réservation, avec ce que la commande porte.
 * Leçon d'un essai réel du tableau animé : son écran disait « Tout est bon », puis la fabrication refusait après la
 * confirmation du prix. Ici, un refus possible sans dépense est dit avant le prix, avec la même phrase partout.
 *
 * Une information inconnue de l'appelant (`undefined` : la validation du cas, la voix, le mot pris, vus du moteur) n'est
 * pas contrôlée par lui : le service, qui les connaît, l'a contrôlée avant.
 */
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { FinTable } from "@/briques/fins";
import { empreinteCas, verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import type { ReseauCas } from "@/formats/cas-concret";
import { refusEcransFournis, type EcranFourni } from "./captures";
import { motValide, planDesFins } from "./fins";
import { faitsAConfirmer, reglesHonnetete, verifierDescription } from "./honnetete";
import { annonceConformite } from "./regles";

/**
 * X8 · Refus quand aucune voix prête de HeyGen n'est disponible pour le format : ce qu'il faut faire, en une phrase (la
 * feuille y ajoute le lien vers l'onglet « Voix »). La voix du format est la voix EFFECTIVE du format de l'avocat
 * (désignée, sinon la voix habituelle) : aucune désignation explicite n'est demandée.
 */
export const CONSIGNE_VOIX_CAS_CONCRET = "Votre voix n'est pas prête : ouvrez Personnages, Voix, et vérifiez que votre voix HeyGen est reliée et prête.";

export const PHRASES_AVANT_PRIX = Object.freeze({
  casAbsent: "Ce cas n'existe plus.",
  casInvalide: "Ce cas est incomplet : reprenez-le avant de fabriquer.",
  faitSansSource: "Un chiffre du cas n'a pas sa source : complétez-le avant de fabriquer.",
  casChange: "Ce cas a changé : relisez-le avant de fabriquer.",
  sansReseau: "Choisissez au moins un réseau.",
  motInvalide: "Le mot doit compter 2 à 24 lettres ou chiffres, sans espace.",
  nonValide: "Ce cas n'est pas encore validé : validez-le ou fabriquez un essai.",
  voix: "Votre voix n'est pas prête.",
  motPris: "Ce mot est déjà pris par une autre vidéo.",
  conformite: "Ce cas parle de conformité sans la phrase validée : ajoutez-la au cas ou retirez cette mention.",
  honnetete: "Ce cas dit plus que votre description : reprenez-la avant de fabriquer.",
  aConfirmer: "Un chiffre est à confirmer : confirmez-le ou retirez-le avant de fabriquer.",
});

const NOM_RESEAU: Readonly<Record<ReseauCas, string>> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };
const liste = (t: readonly string[]) => (t.length <= 1 ? (t[0] ?? "") : `${t.slice(0, -1).join(", ")} et ${t[t.length - 1]}`);

/** Phrase d'un réseau coché sans fin utilisable. */
export const phraseSansFin = (reseaux: readonly ReseauCas[]): string => `Aucune fin utilisable pour ${liste(reseaux.map((r) => NOM_RESEAU[r]))} : décochez ce réseau.`;

export interface DemandeAvantPrix {
  /** Le cas du catalogue ; absent : il n'existe plus. */
  cas: CasConcret | undefined;
  /** Empreinte du cas telle que l'écran l'a montrée. */
  empreinteVue?: string;
  reseaux: readonly ReseauCas[];
  mot: string;
  avecMot: boolean;
  /** Réseaux cochés où le mot est branché (le mot n'est dit que là). */
  motSur: readonly ReseauCas[];
  essai: boolean;
  /** Le cas est validé (par Will ou par le réglage) ; inconnu : non contrôlé. */
  valide?: boolean;
  /** La voix du format est prête ; inconnu : non contrôlé. */
  voixPrete?: boolean;
  /** Le mot est déjà dit par une autre vidéo ; inconnu : non contrôlé. */
  motPris?: boolean;
  table?: readonly FinTable[];
  /**
   * P2R : cas de la porte B, le texte libre dont il vient. Présent : la description et la garde d'honnêteté
   * (`honnetete.ts`) sont rejouées avant le prix ; absent (porte A) : rien.
   */
  description?: string;
  /**
   * P2S : faits d'un cas de la porte B confirmés par Will (identifiants). Un fait « à confirmer » (`faitsAConfirmer`) qui
   * n'y est pas refuse la fabrication.
   */
  faitsConfirmes?: readonly string[];
  /** P2C : images déposées par Will pour les écrans derrière une connexion ; absent : non contrôlé. */
  ecransFournis?: readonly EcranFourni[];
}

/** Textes du cas que la vidéo peut dire. */
const textesDuCas = (cas: CasConcret): string[] => [cas.titre, cas.promesse, ...cas.avant.taches, ...cas.etapes.flatMap((e) => [e.titre, e.ligne, e.detail]), cas.resteHumain, cas.resultat, ...cas.faits.map((f) => f.enonce)];

/** Le refus (une phrase) que la fabrication opposerait sans appel payant ; `null` : rien ne s'y oppose. */
export function refusAvantPrix(d: DemandeAvantPrix): string | null {
  const { cas } = d;
  if (!cas) return PHRASES_AVANT_PRIX.casAbsent;
  const lu = verifierCas(cas);
  if (!lu.ok) return lu.raisons.some((r) => /^faits\.\d+\.(source|preuve)/.test(r)) ? PHRASES_AVANT_PRIX.faitSansSource : PHRASES_AVANT_PRIX.casInvalide;
  if (d.empreinteVue && d.empreinteVue !== empreinteCas(cas)) return PHRASES_AVANT_PRIX.casChange;
  if (!d.reseaux.length) return PHRASES_AVANT_PRIX.sansReseau;
  if (d.avecMot && !motValide(d.mot.trim())) return PHRASES_AVANT_PRIX.motInvalide;
  if (!d.essai && d.valide === false) return PHRASES_AVANT_PRIX.nonValide;
  if (d.voixPrete === false) return PHRASES_AVANT_PRIX.voix;
  if (d.motSur.length && d.motPris === true) return PHRASES_AVANT_PRIX.motPris;
  if (!cas.conformite?.rgpd && textesDuCas(cas).some(annonceConformite)) return PHRASES_AVANT_PRIX.conformite;
  const ecran = refusEcransFournis(d.ecransFournis, cas);
  if (ecran) return ecran;
  if (d.description !== undefined) {
    const description = verifierDescription(d.description);
    if (description.length) return description[0];
    if (reglesHonnetete(cas, d.description).length) return PHRASES_AVANT_PRIX.honnetete;
    const confirmes = new Set(d.faitsConfirmes ?? []);
    if (faitsAConfirmer(cas, d.description).some((f) => !confirmes.has(f.id))) return PHRASES_AVANT_PRIX.aConfirmer;
  }
  const mot = motValide(d.mot.trim()) ? d.mot.trim() : cas.mot;
  const plan = planDesFins({ reseaux: d.reseaux, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot, ...(cas.motDit && mot.toUpperCase() === cas.mot.toUpperCase() ? { motDit: cas.motDit } : {}), avecMot: d.avecMot, motSur: d.motSur, table: d.table ?? TABLE_FINS_DIAGNOSTIC });
  const sansFin = plan.sansFin.flatMap((s) => s.reseaux);
  if (sansFin.length || !plan.fins.length) return phraseSansFin(sansFin.length ? sansFin : d.reseaux);
  return null;
}
