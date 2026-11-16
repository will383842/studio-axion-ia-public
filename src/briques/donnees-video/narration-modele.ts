/**
 * NARRATION PAR PHRASES À TROUS (G4-05) — le texte dit est écrit par le code, depuis la donnée, sans Claude : 0 €.
 * Gabarits fixes en français ; chaque nombre vient d'un indicateur ou d'un pourcentage d'évolution calculé ici
 * (|après − avant| / |avant| × 100, arrondi à l'entier) puis vérifié par `garderChiffres` (G4-03).
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

/** Donnée + un indicateur par pourcentage écrit : ce sont des calculs du code, déclarés à la garde. */
function avecPourcentages(donnee: TableauDeBord, pourcentages: number[]): TableauDeBord {
  const ajoutes: IndicateurTableau[] = pourcentages.map((v, i) => ({ id: `evolution-${i}`, libelle: "Évolution", valeur: v, unite: "%", precision: 0, sens: "hausse-bonne" }));
  return { ...donnee, indicateurs: [...donnee.indicateurs, ...ajoutes] };
}

export function narrationModele(donnee: TableauDeBord): NarrationModele {
  const remarques: string[] = [];
  const pourcentages: number[] = [];
  const parId = new Map(donnee.indicateurs.map((i) => [i.id, i]));

  const ouverture: Phrase = { genre: "ouverture", texte: finir(`Voici le tableau de bord « ${donnee.titre} », période : ${donnee.periode.libelle}`) };
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
    const pct = Math.round((Math.abs(ap.valeur - av.valeur) / Math.abs(av.valeur)) * 100);
    pourcentages.push(pct);
    const sens = ap.valeur > av.valeur ? "de plus" : "de moins";
    const bon = (ap.valeur > av.valeur) === (ap.sens === "hausse-bonne");
    phrasesComparaison.push({
      genre: "comparaison",
      texte: finir(`${lib} passe de ${valeurDite(av)} à ${valeurDite(ap)}, soit ${ecrireNombre(pct, 0)} pour cent ${sens}, ${bon ? "ce qui est favorable" : "ce qui demande de l'attention"}`),
    });
  }

  const phrasesAlerte = donnee.alertes.map((a): Phrase => ({ genre: "alerte", texte: finir(`Point d'attention : ${minuscule(a.texte)}`) }));

  // Ordre d'importance : indicateurs clés, comparaisons, alertes, puis les autres indicateurs.
  const cles = phrasesIndicateur.slice(0, INDICATEURS_CLES);
  const ordre: Phrase[] = [...cles, ...phrasesComparaison, ...phrasesAlerte, ...phrasesIndicateur.slice(INDICATEURS_CLES)];

  // Garde : une phrase au nombre non prouvé est retirée.
  const donneeGardee = avecPourcentages(donnee, pourcentages);
  const verifiee = (p: Phrase): boolean => {
    const v = garderChiffres(donneeGardee, { textesEcran: [], texteDit: p.texte });
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
