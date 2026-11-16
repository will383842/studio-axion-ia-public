/**
 * NARRATION PAR PHRASES À TROUS (G4-05) — le texte dit est écrit par le code, depuis la donnée, sans Claude : 0 €.
 * Gabarits fixes en français ; chaque nombre vient d'un indicateur ou d'un pourcentage d'évolution calculé ici
 * (|après − avant| / |avant| × 100, arrondi à la précision de l'indicateur « après », 0 = entier) et dit seulement si la donnée
 * le prouve (calcul déclaré recalculé par `garderChiffres`, G4-03) ; sinon la comparaison est dite sans pourcentage.
 * Une phrase dont un nombre n'est pas prouvé est retirée, avec une remarque.
 * Pure : aucun accès disque ou réseau. Rien ne l'importe en production (G4-06 et G4-09 s'y appuieront).
 * Éteint par défaut : ce module ne s'exécute que si un appelant le choisit.
 */
import { garderChiffres } from "./garde-chiffres";
import type { IndicateurTableau, TableauDeBord } from "./types";

/** Débit par défaut de la voix (mots/s), le même que `src/briques/index.ts` quand le format est inconnu. */
const MOTS_PAR_SECONDE = 2.6;
const DUREE_MIN_SEC = 30;
const DUREE_MAX_SEC = 60;
const MOTS_MIN = Math.ceil(DUREE_MIN_SEC * MOTS_PAR_SECONDE); // 78
const MOTS_MAX = Math.floor(DUREE_MAX_SEC * MOTS_PAR_SECONDE); // 156
/** Indicateurs toujours racontés en premier (les « clés »). */
const INDICATEURS_CLES = 3;

export interface NarrationModele {
  texte: string;
  phrases: string[];
  dureeEstimeeSec: number;
  remarques: string[];
}

type Genre = "ouverture" | "indicateur" | "comparaison" | "alerte" | "cloture";
interface Phrase {
  genre: Genre;
  texte: string;
}

const compterMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;

function arrondir(v: number, precision: number): number {
  const f = 10 ** precision;
  return Math.round(v * f) / f;
}

/** Nombre écrit comme la voix le lit : virgule décimale, espaces entre milliers. */
function ecrireNombre(v: number, precision: number): string {
  const [entier, decimales] = Math.abs(arrondir(v, precision)).toFixed(precision).split(".");
  const milliers = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const corps = decimales ? `${milliers},${decimales}` : milliers;
  return v < 0 && Number(corps.replace(/\s/g, "").replace(",", ".")) !== 0 ? `moins ${corps}` : corps;
}

function uniteDite(unite: string): string {
  if (unite === "€") return "euros";
  if (unite === "%") return "pour cent";
  return unite;
}

const valeurDite = (i: IndicateurTableau): string => `${ecrireNombre(i.valeur, i.precision)} ${uniteDite(i.unite)}`;
const minuscule = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);
const majuscule = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const finir = (t: string): string => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** Vrai si la garde (G4-03) accepte ce texte contre la donnée REÇUE, telle quelle (aucun calcul ajouté par ce module). */
const prouve = (donnee: TableauDeBord, texte: string): boolean => garderChiffres(donnee, { textesEcran: [], texteDit: texte }).horsDonnee.length === 0;

export function narrationModele(donnee: TableauDeBord): NarrationModele {
  const remarques: string[] = [];
  const parId = new Map(donnee.indicateurs.map((i) => [i.id, i]));

  // Ouverture : titre + période ; si le libellé de période porte un nombre non prouvé (ex. une année), on le laisse de côté.
  const ouvertures = [
    `Voici le tableau de bord « ${donnee.titre} », période : ${donnee.periode.libelle}`,
    `Voici le tableau de bord « ${donnee.titre} »`,
    "Voici le tableau de bord",
  ].map(finir);
  const indiceOuverture = ouvertures.findIndex((t) => prouve(donnee, t));
  if (indiceOuverture > 0) remarques.push(`ouverture dite sans la période : nombre non prouvé par la donnée dans « ${donnee.periode.libelle} »`);
  const ouverture: Phrase = { genre: "ouverture", texte: ouvertures[indiceOuverture === -1 ? ouvertures.length - 1 : indiceOuverture] };
  const cloture: Phrase = { genre: "cloture", texte: finir(`Source des données : ${donnee.source}. Voilà l'essentiel à retenir`) };

  const phrasesIndicateur = donnee.indicateurs.map((i): Phrase => ({ genre: "indicateur", texte: finir(`${majuscule(i.libelle)} : ${valeurDite(i)}`) }));

  const phrasesComparaison: Phrase[] = [];
  for (const c of donnee.comparaisons) {
    const av = parId.get(c.avant);
    const ap = parId.get(c.apres);
    if (!av || !ap) continue;
    if (av.valeur === 0) {
      remarques.push(`comparaison « ${c.avant} → ${c.apres} » ignorée : valeur de départ nulle`);
      continue;
    }
    const lib = majuscule(ap.libelle);
    if (av.valeur === ap.valeur) {
      phrasesComparaison.push({ genre: "comparaison", texte: finir(`${lib} reste stable à ${valeurDite(ap)}`) });
      continue;
    }
    // Pourcentage arrondi à la précision de l'indicateur « après » (0 = entier) ; dit seulement si la donnée le prouve
    // (calcul déclaré, recalculé par la garde). Sinon : la comparaison est dite sans pourcentage.
    const pct = arrondir((Math.abs(ap.valeur - av.valeur) / Math.abs(av.valeur)) * 100, ap.precision);
    const bon = (ap.valeur > av.valeur) === (ap.sens === "hausse-bonne");
    const avis = bon ? "ce qui est favorable" : "ce qui demande de l'attention";
    const base = `${lib} passe de ${valeurDite(av)} à ${valeurDite(ap)}`;
    const avecPct = finir(`${base}, soit ${ecrireNombre(pct, ap.precision)} pour cent ${ap.valeur > av.valeur ? "de plus" : "de moins"}, ${avis}`);
    if (prouve(donnee, avecPct)) {
      phrasesComparaison.push({ genre: "comparaison", texte: avecPct });
    } else {
      remarques.push(`comparaison « ${c.avant} → ${c.apres} » dite sans pourcentage : ${ecrireNombre(pct, ap.precision)} % non prouvé par un calcul déclaré`);
      phrasesComparaison.push({ genre: "comparaison", texte: finir(`${base}, ${avis}`) });
    }
  }

  const phrasesAlerte = donnee.alertes.map((a): Phrase => ({ genre: "alerte", texte: finir(`Point d'attention : ${minuscule(a.texte)}`) }));

  // Ordre d'importance : indicateurs clés, comparaisons, alertes, puis les autres indicateurs.
  const cles = phrasesIndicateur.slice(0, INDICATEURS_CLES);
  const ordre: Phrase[] = [...cles, ...phrasesComparaison, ...phrasesAlerte, ...phrasesIndicateur.slice(INDICATEURS_CLES)];

  // Garde : une phrase au nombre non prouvé est retirée.
  const verifiee = (p: Phrase): boolean => {
    const v = garderChiffres(donnee, { textesEcran: [], texteDit: p.texte });
    if (v.horsDonnee.length === 0) return true;
    remarques.push(`phrase retirée (nombre hors donnée : ${v.horsDonnee.map((h) => h.brut).join(", ")}) : « ${p.texte} »`);
    return false;
  };
  const ouvertureOk = verifiee(ouverture) ? [ouverture] : [];
  const clotureOk = verifiee(cloture) ? [cloture] : [];
  const candidates = ordre.filter(verifiee);

  const total = (retenues: Phrase[]): number => compterMots([...ouvertureOk, ...retenues, ...clotureOk].map((p) => p.texte).join(" "));

  // Tant que c'est trop court, les indicateurs clés puis les suivants sont déjà dans `ordre` : on garde tout ce qui tient.
  let retenues = [...candidates];
  let retire = 0;
  while (retenues.length > 1 && total(retenues) > MOTS_MAX) {
    retenues = retenues.slice(0, -1);
    retire += 1;
  }
  if (retire > 0) remarques.push(`${retire} phrase(s) retirée(s) pour tenir en ${DUREE_MAX_SEC} s (les moins importantes, la dernière d'abord)`);
  if (total(retenues) < MOTS_MIN) remarques.push("donnée trop courte");

  // Ordre de lecture : ouverture, indicateurs, comparaisons, alertes, clôture.
  const rang: Record<Genre, number> = { ouverture: 0, indicateur: 1, comparaison: 2, alerte: 3, cloture: 4 };
  const lecture = [...ouvertureOk, ...retenues, ...clotureOk]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rang[a.p.genre] - rang[b.p.genre] || a.i - b.i)
    .map((x) => x.p.texte);

  const texte = lecture.join(" ");
  return { texte, phrases: lecture, dureeEstimeeSec: Math.round((compterMots(texte) / MOTS_PAR_SECONDE) * 10) / 10, remarques };
}
