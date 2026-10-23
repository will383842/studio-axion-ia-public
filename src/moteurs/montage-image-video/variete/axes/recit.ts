/**
 * Axe « récit » de la variété (lot REC, doc 72 axe 2). Le déroulé vit dans le SCRIPT (`recettes.ts`, `ecriture.ts`,
 * `regles.ts`) : ici, on ne fait que l'accompagner à l'image, sans rien changer de ce qui est montré ni quand (les
 * événements ne bougent pas). Chaque bloc concerné reçoit `variete.donnees.recit` (heures RELATIVES au bloc), lu par
 * `studio-rendu/compositions/image-video/variete/recit/calque.tsx` :
 * - REC-B « résultat puis comment » : sur le résultat dit d'abord, le « comment » monte déjà du bas (vraies cartes,
 *   sans texte) ; sur le début de l'explication, le résultat reste rangé dans une pastille (« 80 % »).
 * - REC-C « le parcours d'un cas » : une bulle (« 23h14 ») suit le message de nœud en nœud sur la toile ; le téléphone
 *   du client ferme le bas.
 * - REC-D « en 3 étapes annoncées » : le repère « 1/3 → 3/3 » reste sur le schéma (correctif 72 § 7 point 5), avec les
 *   trois étapes en vraies cartes dans le bas.
 * Variante impossible (le script ne suit pas le déroulé, la carte n'a pas de quoi le dessiner) : rien n'est posé et
 * le repli est inscrit dans `replis`. PUR : aucune date, aucun hasard.
 */
import type { FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage, NoeudCarte } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import { ETAPES_RECIT_D, recitsPossibles, ROLES_ETAPES_RECIT_D, type CodeRecit } from "../../recettes";
import type { BlocRenduIV, PlanIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";

/** Une carte du schéma dessinée dans le bas (zone d'appoint) : son icône, sa couleur, coche si elle valide. */
export interface CarteAppointRecit {
  icone: string;
  couleur: "orange" | "noir" | "vert";
  coche: boolean;
}

/** Fond de la scène à partir de l'heure `t` (relative au bloc) : le calque y accorde ses couleurs. */
export type FondRecit = { t: number; fond: "sombre" | "ivoire" };

/** Données lues par le calque « récit » (heures en secondes, relatives au début du bloc). */
export type DonneesRecitIV = { fonds: FondRecit[] } & (
  | { code: "REC-B"; role: "resultat"; appoint: CarteAppointRecit[] }
  | { code: "REC-B"; role: "comment"; resultat: string; jusqua: number; appoint: CarteAppointRecit[] }
  | { code: "REC-C"; role: "suivi"; libelle: string | null; depart: string; noeuds: string[]; reponse: number | null; masques: { debut: number; fin: number }[] }
  | { code: "REC-D"; role: "etapes"; changements: { t: number; numero: number }[]; total: number; etapes: CarteAppointRecit[]; place: "toile" | "haut"; masques: { debut: number; fin: number }[] }
);

type SansFonds<T> = T extends unknown ? Omit<T, "fonds"> : never;

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Couleur d'un nœud ramenée aux trois de la charte. */
const couleurDe = (n: NoeudCarte): CarteAppointRecit["couleur"] => (n.couleur === "orange" ? "orange" : n.couleur === "vert" ? "vert" : "noir");
const carteDe = (n: NoeudCarte): CarteAppointRecit => ({ icone: (n.icone && iconeDe(n.icone)) || "message", couleur: couleurDe(n), coche: n.role === "resultat" || n.couleur === "vert" });

/** Rang (1 à 3) de l'étape d'un nœud en REC-D ; 0 s'il n'en a pas. */
const etapeDuNoeud = (n: NoeudCarte | undefined) => (n ? ROLES_ETAPES_RECIT_D.findIndex((rs) => rs.includes(n.role)) + 1 : 0);

/** Les plans de l'explication, dans l'ordre. */
const plansExplication = (plans: readonly PlanIV[]) => plans.filter((p) => p.partie === "explication");

/** Blocs (toile, objets, moments) qui recouvrent l'intervalle [debut, fin[. */
const blocsDans = (blocs: readonly BlocRenduIV[], debut: number, fin: number, sortes: readonly BlocRenduIV["sorte"][]) =>
  blocs.filter((b) => sortes.includes(b.sorte) && b.debut < fin - 1e-6 && b.fin > debut + 1e-6);

/** Fonds des plans qui recouvrent le bloc, en heures relatives (le premier à 0). */
function fondsDuBloc(plans: readonly PlanIV[], b: BlocRenduIV): FondRecit[] {
  const res: FondRecit[] = [];
  for (const p of plans) {
    if (p.fin <= b.debut + 1e-6 || p.debut >= b.fin - 1e-6) continue;
    if (res.at(-1)?.fond !== p.fond) res.push({ t: arrondi(Math.max(0, p.debut - b.debut)), fond: p.fond });
  }
  return res.length ? res : [{ t: 0, fond: "ivoire" }];
}

/** Pose `donnees.recit` sur les blocs choisis (un bloc `variete` n'est jamais transformé). */
function poser(etape: EtapeVarieteIV, ids: ReadonlySet<string>, donnees: (b: BlocRenduIV) => SansFonds<DonneesRecitIV>): EtapeVarieteIV {
  const avec = (b: BlocRenduIV): DonneesRecitIV => ({ fonds: fondsDuBloc(etape.plans, b), ...donnees(b) }) as DonneesRecitIV;
  return {
    ...etape,
    blocs: etape.blocs.map((b) => (ids.has(b.id) && b.sorte !== "variete" && b.variete ? { ...b, variete: { ...b.variete, donnees: { ...b.variete.donnees, recit: avec(b) } } } : b)),
  };
}

function repli(etape: EtapeVarieteIV, code: CodeRecit, raison: string): EtapeVarieteIV {
  return { ...etape, replis: [...etape.replis, { axe: "recit", code, raison }] };
}

/** Nœuds de la carte par id. */
const noeudsParId = (carte: CarteImage) => new Map(carte.noeuds.map((n) => [n.id, n]));

/** Les premières cartes du « comment » : ce qui arrive, puis ce qui décide ou agit (REC-B). */
function cartesDuComment(carte: CarteImage): CarteAppointRecit[] {
  const premier = (roles: readonly string[]) => [...carte.noeuds].sort((a, b) => a.ordre - b.ordre).find((n) => roles.includes(n.role));
  return ROLES_ETAPES_RECIT_D.slice(0, 2).map(premier).filter((n): n is NoeudCarte => !!n).map((n, i) => ({ ...carteDe(n), coche: i === 1 }));
}

/* REC-B ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

function appliquerB(etape: EtapeVarieteIV): EtapeVarieteIV {
  const explication = plansExplication(etape.plans);
  const debutExplication = explication[0]?.debut ?? Infinity;
  const resultatsDabord = etape.plans.filter((p) => p.partie === "resultat" && p.fin <= debutExplication + 1e-6);
  if (!resultatsDabord.length) return repli(etape, "REC-B", "le script ne dit pas le résultat avant l'explication");
  const appoint = cartesDuComment(etape.carte);
  const chiffre = etape.carte.chiffres.find((c) => c.dansBandeau);
  const debutR = resultatsDabord[0]!.debut;
  const finR = resultatsDabord.at(-1)!.fin;
  const surResultat = new Set(blocsDans(etape.blocs, debutR, finR, ["moments", "objets"]).map((b) => b.id));
  // Le début de l'explication : les deux premiers écrans de la fiche, sur la première toile.
  const ecransExpl = [...new Set(explication.map((p) => p.ecran).filter((e): e is string => !!e))];
  const finComment = explication.filter((p) => p.ecran && ecransExpl.slice(0, 2).includes(p.ecran)).at(-1)?.fin ?? debutExplication;
  const toile = blocsDans(etape.blocs, debutExplication, finComment, ["toile"])[0];
  let e = poser(etape, surResultat, () => ({ code: "REC-B", role: "resultat", appoint }));
  if (toile && chiffre) e = poser(e, new Set([toile.id]), (b) => ({ code: "REC-B", role: "comment", resultat: chiffre.brut, jusqua: arrondi(finComment - b.debut), appoint }));
  return e;
}

/* REC-C ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Vues d'ensemble d'une toile (heures relatives) : la bulle s'efface pendant ces instants (le schéma entier est montré). */
const masquesDe = (b: BlocRenduIV) => (b.sorte === "toile" ? (b.proprietes.ensembles ?? []).map((e) => ({ debut: e.debut, fin: e.fin })) : []);

function appliquerC(etape: EtapeVarieteIV): EtapeVarieteIV {
  const depart = [...etape.carte.noeuds].sort((a, b) => a.ordre - b.ordre).find((n) => n.role === "declencheur");
  if (!depart) return repli(etape, "REC-C", "la carte n'a pas de message, d'e-mail ni de commande à suivre");
  const explication = plansExplication(etape.plans);
  if (!explication.length) return repli(etape, "REC-C", "aucune explication à suivre");
  const debut = explication[0]!.debut;
  const fin = explication.at(-1)!.fin;
  const toiles = blocsDans(etape.blocs, debut, fin, ["toile"]);
  if (!toiles.length) return repli(etape, "REC-C", "l'explication n'a pas de toile où suivre le message");
  // L'étiquette de la bulle : l'heure (ou le chiffre) du déclencheur, telle qu'écrite sur l'image ; sinon, aucune.
  const libelle = etape.carte.chiffres.find((c) => c.dansNoeud === depart.id)?.brut ?? null;
  const parcours = [...etape.carte.noeuds].sort((a, b) => a.ordre - b.ordre).map((n) => n.id);
  // La réponse arrive chez le client quand le premier résultat est montré (sa coche) : heure de son écran.
  const resultat = etape.carte.noeuds.find((n) => n.role === "resultat");
  const ecranResultat = resultat ? etape.fiche.ecrans.find((x) => x.refs.includes(resultat.id))?.id : undefined;
  const tReponse = ecranResultat ? etape.plans.find((p) => p.ecran === ecranResultat)?.debut : undefined;
  return poser(etape, new Set(toiles.map((b) => b.id)), (b) => ({ code: "REC-C", role: "suivi", libelle, depart: depart.id, noeuds: parcours, reponse: tReponse === undefined ? null : arrondi(tReponse - b.debut), masques: masquesDe(b) }));
}

/* REC-D ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Heures (absolues) où l'explication passe à l'étape 1, 2, 3 : d'après les nœuds cités par chaque écran, sans reculer. */
export function changementsEtapesRecitD(plans: readonly PlanIV[], etape: Pick<EtapeVarieteIV, "carte" | "fiche">): { t: number; numero: number }[] {
  const parId = noeudsParId(etape.carte);
  const refs = new Map(etape.fiche.ecrans.map((e) => [e.id, e.refs]));
  const res: { t: number; numero: number }[] = [];
  let courant = 0;
  for (const p of plansExplication(plans)) {
    const rangs = (p.ecran ? (refs.get(p.ecran) ?? []) : []).map((r) => etapeDuNoeud(parId.get(r))).filter((k) => k > 0);
    const k = Math.max(courant === 0 ? 1 : courant, ...rangs);
    if (k > courant) {
      res.push({ t: arrondi(p.debut), numero: k });
      courant = k;
    }
  }
  return res;
}

function appliquerD(etape: EtapeVarieteIV): EtapeVarieteIV {
  if (etape.fiche.chapitres.length) return repli(etape, "REC-D", "image en chapitres : son repère existe déjà");
  const changements = changementsEtapesRecitD(etape.plans, etape);
  if (changements.at(-1)?.numero !== ETAPES_RECIT_D) return repli(etape, "REC-D", "l'explication ne passe pas par trois étapes lisibles sur le schéma");
  const explication = plansExplication(etape.plans);
  const ids = new Set(blocsDans(etape.blocs, explication[0]!.debut, explication.at(-1)!.fin, ["toile", "objets", "moments"]).map((b) => b.id));
  const premiers = ROLES_ETAPES_RECIT_D.map((rs) => [...etape.carte.noeuds].sort((a, b) => a.ordre - b.ordre).find((n) => rs.includes(n.role))!);
  const etapes = premiers.map(carteDe);
  return poser(etape, ids, (b) => ({ code: "REC-D", role: "etapes", changements: changements.map((c) => ({ t: arrondi(c.t - b.debut), numero: c.numero })), total: ETAPES_RECIT_D, etapes, place: b.sorte === "toile" ? "toile" : "haut", masques: masquesDe(b) }));
}

export const AXE_RECIT: AxeVarieteIV = {
  axe: "recit",
  possibles(carte: CarteImage, format: FormatIV) {
    void format;
    return recitsPossibles(carte);
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    switch (etape.recette.recit) {
      case "REC-B":
        return appliquerB(etape);
      case "REC-C":
        return appliquerC(etape);
      case "REC-D":
        return appliquerD(etape);
      default:
        return etape;
    }
  },
};
