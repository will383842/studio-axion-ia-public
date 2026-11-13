"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent, type PointerEvent as EvtPointeur } from "react";
import { BandeauAnnuler } from "@/components/ui/BandeauAnnuler";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { plageSemaine } from "@/lib/calendrier-plages";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";
import { CarteProposition } from "./CarteProposition";
import type { TableLibelles } from "./PastilleStatutPlan";
import { libelleJour } from "./BarreVue";
import { CarteEntreeCalendrier, MonogrammeReseau, estVerrouillee, heureLisible, jourLisible, nomReseau, styleReseau, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";

export type DensiteSemaine = "compact" | "visuel";

/** CAL-09 : Compact montre plus de cartes par case, sans titre ; Visuel en montre moins, avec le titre. */
export const DENSITES_SEMAINE: Readonly<Record<DensiteSemaine, { libelle: string; max: number; avecTitre: boolean }>> = {
  compact: { libelle: "Compact", max: 3, avecTitre: false },
  visuel: { libelle: "Visuel", max: 2, avecTitre: true },
};

export interface ProprietesGrilleSemaine {
  /** N'importe quel jour de Paris (AAAA-MM-JJ) de la semaine à montrer ; illisible : la semaine d'aujourd'hui. */
  semaineDu: string;
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ), fourni par l'appelant. */
  aujourdhui: string;
  entrees: readonly EntreeCarte[];
  /** Réseaux allumés : un couloir par réseau (défaut : les quatre de la maquette). */
  reseaux?: readonly IdReseau[];
  /** Ouvrir une carte : par lien (rendu serveur) ou par geste (rendu client). */
  lienEntree?: (entree: EntreeCarte) => string | null | undefined;
  onOuvrirEntree?: (entree: EntreeCarte) => void;
  /** Ouvrir la journée par son en-tête. */
  lienJour?: (jour: string) => string;
  onOuvrirJour?: (jour: string) => void;
  /** « + » d'une case d'aujourd'hui ou à venir. Sans lien ni geste, aucun « + » n'est affiché. */
  lienAjout?: (jour: string, reseau: IdReseau) => string;
  onAjouter?: (jour: string, reseau: IdReseau) => void;
  /**
   * Densité (point d'extension de RC-37 et CAL-09) : nombre de cartes montrées par case, entier de 1 au moins.
   * Au-delà, la case garde les premières (par heure) et ajoute « + N autres », nommé, qui ouvre `lienPlus` ou
   * appelle `onVoirPlus`. Sans lien ni geste, ou si la valeur n'est pas un entier de 1 au moins, toutes les cartes restent
   * montrées : rien n'est caché sans moyen de le retrouver.
   */
  maxParCase?: number;
  /**
   * CAL-09 : densité Compact ou Visuel. Fixe le nombre de cartes par case (sauf `maxParCase`) et l'affichage du titre.
   * Au-delà, « + N autres » ouvre `lienPlus` ou appelle `onVoirPlus` ; sans l'un ni l'autre, il déplie la case sur place
   * et montre toutes ses publications. Absente : rendu d'avant, sans titre.
   */
  densite?: DensiteSemaine;
  lienPlus?: (reseau: IdReseau, jour: string) => string;
  onVoirPlus?: (reseau: IdReseau, jour: string) => void;
  /** Table de libellés d'état fournie de l'extérieur (CAL-10), transmise aux cartes. */
  libellesEtat?: TableLibelles;
  /** Vrai si une publication est attendue ce jour-là sur ce réseau : la case vide dit « Créneau vide ». */
  attendu?: (reseau: IdReseau, jour: string) => boolean;
  /** Clés des cartes à marquer « Trop proches » (voir AlerteProximite). */
  tropProches?: ReadonlySet<string>;
  /** CAL-08 : clé de carte → premier manque (une seule icône d'alerte par carte). */
  alertes?: ReadonlyMap<string, string>;
  /** CAL-08 : nombre de manques par jour (AAAA-MM-JJ) ; un jour sans manque n'affiche rien. */
  manquesParJour?: Readonly<Record<string, number>>;
  /** CAL-08 : filtre « À compléter » : seules les publications incomplètes. */
  aCompleter?: boolean;
  /** Vrai si un filtre autre que les réseaux est actif : change le message de semaine vide. */
  filtresActifs?: boolean;
  /**
   * CAL-11b : rend les publications futures déplaçables (glisser, appui long, Alt + flèches). Appelée UNE fois par déplacement
   * avec le nouveau jour ; l'appelant enregistre (action de report) puis renvoie les entrées à jour. Absente : rendu d'avant.
   */
  onDeplacer?: (entree: EntreeCarte, jour: string) => void;
  /** CAL-11b : appelée par « Annuler » (bandeau de 10 secondes) avec la carte et son ancien jour ; l'appelant remet la date. */
  onAnnulerDeplacement?: (entree: EntreeCarte, jourAvant: string) => void;
  /**
   * CAL-17 : propositions de l'équipe IA, montrées en cartes pointillées « Proposée » dans la case de leur réseau et de leur jour.
   * Jamais déplaçables ni programmables ici. Sans `lienAValider`, rien n'est montré.
   */
  propositions?: readonly { entree: EntreeCarte; pourquoi?: string; ressembleA?: string }[];
  /** CAL-17 : écran « À valider » de l'usine, seul lieu de validation. */
  lienAValider?: string;
  className?: string;
}

export const MESSAGE_AUTRE_RESEAU = "Pour un autre réseau, ouvrez la publication et choisissez Dupliquer.";
const MESSAGE_PASSE = "Ce jour est passé : choisissez un jour à venir.";
const AIDE_GLISSER = "Pour déplacer une publication : Alt et flèche gauche ou droite, ou glissez-la sur un autre jour. Un appui long suffit sur téléphone.";
const DELAI_APPUI_LONG_MS = 400;
const SEUIL_SOURIS_PX = 6;

export interface CibleDepot {
  reseau: IdReseau;
  jour: string;
}

export type DecisionDepot = { ok: true; jour: string } | { ok: false; message?: string };

/** Une publication future et non publiée se déplace ; une passée ou publiée reste en place. */
export function peutGlisser(entree: Pick<EntreeCarte, "etat" | "jour">, aujourdhui: string): boolean {
  return !estVerrouillee(entree, aujourdhui);
}

/** Même réseau, jour non passé, jour différent. Un autre réseau est refusé avec le message « Dupliquer ». */
export function decisionDepot(entree: EntreeCarte, cible: CibleDepot, aujourdhui: string): DecisionDepot {
  if (!peutGlisser(entree, aujourdhui)) return { ok: false };
  if (cible.reseau !== entree.reseau) return { ok: false, message: MESSAGE_AUTRE_RESEAU };
  if (!jourLisible(cible.jour) || (jourLisible(aujourdhui) && cible.jour < aujourdhui)) return { ok: false, message: MESSAGE_PASSE };
  if (cible.jour === entree.jour) return { ok: false };
  return { ok: true, jour: cible.jour };
}

/** Jour voisin (sens -1 ou 1) dans la semaine montrée, jamais passé ; null si la carte ne peut pas bouger ou s'il n'y en a pas. */
export function jourVoisin(entree: EntreeCarte, sens: -1 | 1, jours: readonly string[], aujourdhui: string): string | null {
  if (!peutGlisser(entree, aujourdhui)) return null;
  const i = jours.indexOf(entree.jour);
  const voisin = i < 0 ? undefined : jours[i + sens];
  return voisin !== undefined && decisionDepot(entree, { reseau: entree.reseau, jour: voisin }, aujourdhui).ok ? voisin : null;
}

/**
 * Un geste de déplacement (souris, doigt ou clavier). Il ne fait que PROPOSER un jour à l'appelant (`onDeplacer`) ;
 * l'enregistrement passe par l'action de report (L4-06). Un geste ne compte qu'une fois : après un lâcher ou une annulation, plus rien.
 */
export class GesteDeplacement {
  private entree: EntreeCarte | null = null;
  constructor(
    private readonly aujourdhui: string,
    private readonly onDeplacer: (entree: EntreeCarte, jour: string) => void,
  ) {}
  saisir(entree: EntreeCarte) {
    this.entree = entree;
  }
  get actif() {
    return this.entree !== null;
  }
  annuler() {
    this.entree = null;
  }
  lacher(cible: CibleDepot | null): DecisionDepot {
    const entree = this.entree;
    this.entree = null;
    if (!entree || !cible) return { ok: false };
    const d = decisionDepot(entree, cible, this.aujourdhui);
    if (d.ok) this.onDeplacer(entree, d.jour);
    return d;
  }
}

const cibleSous = (x: number, y: number): CibleDepot | null => {
  const c = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-case]")?.dataset.case;
  const [reseau, jour] = c ? c.split("|") : [];
  return reseau && jour ? { reseau: reseau as IdReseau, jour } : null;
};

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const VIDE = "mt-2 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-sm text-texte-doux";
const AJOUT = "mt-auto grid min-h-[44px] place-items-center rounded-[9px] border-[1.5px] border-dashed border-trait-fort p-1 text-center text-xs font-bold text-texte-faible hover:border-orange hover:text-orange-vif";

/**
 * Semaine en couloirs : une ligne par réseau, une colonne par jour (lundi d'abord), sans lignes d'heures.
 * Aujourd'hui est marqué ; les jours passés sont hachurés et sans « + ».
 */
function useGlisse(aujourdhui: string, onDeplacer: ProprietesGrilleSemaine["onDeplacer"], onAnnulerDeplacement: ProprietesGrilleSemaine["onAnnulerDeplacement"]) {
  const [saisie, setSaisie] = useState<EntreeCarte | null>(null);
  const [annonce, setAnnonce] = useState("");
  const [dernier, setDernier] = useState<{ entree: EntreeCarte; avant: string; vers: string; n: number } | null>(null);
  const geste = useRef<GesteDeplacement | null>(null);
  const attente = useRef<{ id: number; entree: EntreeCarte; x: number; y: number; minuteur?: ReturnType<typeof setTimeout> } | null>(null);
  const aGlisse = useRef(false);
  const compteur = useRef(0);
  const aujourdhuiRef = useRef(aujourdhui);
  const deplacerRef = useRef(onDeplacer);
  useEffect(() => {
    aujourdhuiRef.current = aujourdhui;
    deplacerRef.current = onDeplacer;
  });
  const saisieRef = useRef<EntreeCarte | null>(null);

  const terminer = (cible: CibleDepot | null) => {
    const g = geste.current;
    geste.current = null;
    setSaisie(null);
    if (!g) return;
    const entree = saisieRef.current;
    const d = g.lacher(cible);
    if (d.ok && entree) {
      compteur.current += 1;
      setDernier({ entree, avant: entree.jour, vers: d.jour, n: compteur.current });
      setAnnonce(`Déplacée au ${libelleJour(d.jour)}, ${heureLisible(entree.heure) ?? ""}.`.replace(", .", "."));
    } else if (!d.ok && d.message) setAnnonce(d.message);
    else if (!d.ok && cible) setAnnonce("Publication laissée à sa place.");
  };
  const prendre = (entree: EntreeCarte) => {
    geste.current = new GesteDeplacement(aujourdhuiRef.current, (e, jour) => deplacerRef.current?.(e, jour));
    geste.current.saisir(entree);
    saisieRef.current = entree;
    setSaisie(entree);
    setAnnonce("");
  };

  // Pendant un geste : suivre le pointeur sur toute la page, lâcher, Échap ; sur téléphone, ne pas faire défiler.
  useEffect(() => {
    if (!saisie) return;
    const fin = (e: PointerEvent) => terminer(cibleSous(e.clientX, e.clientY));
    const annule = () => {
      geste.current?.annuler();
      terminer(null);
    };
    const touche = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (e.key === "Escape") annule();
    };
    const bloquer = (e: TouchEvent) => e.cancelable && e.preventDefault();
    document.addEventListener("pointerup", fin);
    document.addEventListener("pointercancel", annule);
    document.addEventListener("keydown", touche);
    document.addEventListener("touchmove", bloquer, { passive: false });
    return () => {
      document.removeEventListener("pointerup", fin);
      document.removeEventListener("pointercancel", annule);
      document.removeEventListener("keydown", touche);
      document.removeEventListener("touchmove", bloquer);
    };
  }, [saisie]);

  const surPointeurBas = (e: EntreeCarte, ev: EvtPointeur<HTMLDivElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const prec = attente.current;
    if (prec?.minuteur) clearTimeout(prec.minuteur);
    aGlisse.current = false;
    const a = { id: ev.pointerId, entree: e, x: ev.clientX, y: ev.clientY, minuteur: undefined as ReturnType<typeof setTimeout> | undefined };
    // Doigt : appui long avant de saisir, pour garder le défilement. Souris : saisie dès que le pointeur a bougé un peu.
    if (ev.pointerType !== "mouse") {
      a.minuteur = setTimeout(() => {
        if (attente.current === a) {
          aGlisse.current = true;
          prendre(e);
        }
      }, DELAI_APPUI_LONG_MS);
    }
    attente.current = a;
  };
  const surPointeurBouge = (ev: EvtPointeur<HTMLDivElement>) => {
    const a = attente.current;
    if (!a || a.id !== ev.pointerId) return;
    const loin = Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > SEUIL_SOURIS_PX;
    if (ev.pointerType === "mouse" && loin && !geste.current) {
      aGlisse.current = true;
      prendre(a.entree);
    } else if (ev.pointerType !== "mouse" && loin && !geste.current && a.minuteur) {
      // Le doigt a bougé avant la fin de l'appui long : c'est un défilement, pas un déplacement.
      clearTimeout(a.minuteur);
      attente.current = null;
    }
  };
  const surPointeurHaut = () => {
    const a = attente.current;
    if (a?.minuteur) clearTimeout(a.minuteur);
    attente.current = null;
  };
  const surClavier = (e: EntreeCarte, jours: readonly string[], ev: KeyboardEvent<HTMLDivElement>) => {
    if (!ev.altKey || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") || ev.target !== ev.currentTarget.firstElementChild) return;
    ev.preventDefault();
    const jour = jourVoisin(e, ev.key === "ArrowLeft" ? -1 : 1, jours, aujourdhui);
    if (!jour) {
      setAnnonce("Impossible de déplacer plus loin : jour passé ou fin de la semaine.");
      return;
    }
    prendre(e);
    terminer({ reseau: e.reseau, jour });
  };

  const envelopper = (e: EntreeCarte, jours: readonly string[], carte: ReactNode) => {
    const enMain = saisie?.cle === e.cle;
    return (
      <div
        key={e.cle}
        data-glissable={e.cle}
        onPointerDown={(ev) => surPointeurBas(e, ev)}
        onPointerMove={surPointeurBouge}
        onPointerUp={surPointeurHaut}
        onPointerCancel={surPointeurHaut}
        onKeyDown={(ev) => surClavier(e, jours, ev)}
        onClickCapture={(ev) => {
          if (aGlisse.current) {
            aGlisse.current = false;
            ev.preventDefault();
            ev.stopPropagation();
          }
        }}
        style={{ touchAction: enMain ? "none" : "pan-y" }}
        className={cn("min-h-[44px] cursor-grab select-none", enMain && "outline outline-2 outline-accent")}
      >
        {carte}
      </div>
    );
  };
  return { saisie, annonce, dernier, envelopper, annuler: () => {
    if (dernier) onAnnulerDeplacement?.(dernier.entree, dernier.avant);
    setAnnonce("Déplacement annulé : la publication est remise à sa place.");
    setDernier(null);
  }, fin: () => setDernier(null) };
}

type Glisse = ReturnType<typeof useGlisse>;

/** Sans onDeplacer : rendu d'avant, sans état. Avec : le geste vit dans un sous-composant (les hooks restent hors du rendu simple). */
export function GrilleSemaine(p: ProprietesGrilleSemaine) {
  return p.onDeplacer ? <GrilleSemaineGlissable {...p} /> : corpsGrille(p, undefined);
}

function GrilleSemaineGlissable(p: ProprietesGrilleSemaine) {
  const g = useGlisse(p.aujourdhui, p.onDeplacer, p.onAnnulerDeplacement);
  return corpsGrille(p, g);
}

function corpsGrille( { semaineDu, aujourdhui, entrees, reseaux = RESEAUX_CALENDRIER, lienEntree, onOuvrirEntree, lienJour, onOuvrirJour, lienAjout, onAjouter, attendu, maxParCase, densite, lienPlus, onVoirPlus, libellesEtat, tropProches, alertes, manquesParJour, aCompleter, filtresActifs, propositions, lienAValider, className }: ProprietesGrilleSemaine, g: Glisse | undefined) {
  const glissable = Boolean(g);
  const saisie = g?.saisie;
  if (reseaux.length === 0) return <div className={cn(VIDE, className)}>Aucun réseau affiché. Rallumez un réseau ci-dessus.</div>;
  const repere = jourLisible(semaineDu) ? semaineDu : aujourdhui;
  if (!jourLisible(repere)) return <div className={cn(VIDE, className)}>Semaine illisible. Revenez à aujourd&apos;hui.</div>;
  const { jours } = plageSemaine(repere);
  const visibles = trierEntrees(entrees.filter((e) => reseaux.includes(e.reseau) && jours.includes(e.jour) && (!aCompleter || Boolean(alertes?.has(e.cle)))));
  const passe = (jour: string) => jourLisible(aujourdhui) && jour < aujourdhui;
  const peutAjouter = Boolean(lienAjout || onAjouter);
  const reglage = densite ? DENSITES_SEMAINE[densite] : undefined;
  const maxExplicite = Number.isInteger(maxParCase) && (maxParCase as number) >= 1 ? (maxParCase as number) : null;
  const aUneSortie = Boolean(lienPlus || onVoirPlus);
  // Sans densité, comportement d'avant : on ne cache rien sans lien ni geste pour retrouver le reste.
  const limite = reglage ? (maxExplicite ?? reglage.max) : aUneSortie ? maxExplicite : null;
  const avecTitre = Boolean(reglage?.avecTitre);

  const enTete = (jour: string) => {
    const estAujourdhui = jour === aujourdhui;
    const nbManques = manquesParJour?.[jour] ?? 0;
    const libelle = `Ouvrir la journée du ${libelleJour(jour)}`;
    const classes = cn("rounded-lg px-1.5 py-1 text-left text-sm font-bold capitalize", estAujourdhui ? "bg-orange text-sur-orange" : "text-texte-doux", (lienJour || onOuvrirJour) && !estAujourdhui && "hover:bg-surface-2");
    const commun = { "data-entete-jour": jour, "aria-current": estAujourdhui ? ("date" as const) : undefined, className: classes };
    const contenu = (
      <>
        {JOUR_COURT.format(new Date(`${jour}T12:00:00Z`))} <b className={cn("text-base", !estAujourdhui && "text-texte")}>{Number(jour.slice(8))}</b>
        {estAujourdhui && <span className="sr-only"> (aujourd&apos;hui)</span>}
        {nbManques > 0 && (
          <span data-compteur-jour={jour} title={`${nbManques} à compléter`} className="ml-1 rounded-full border border-trait-fort px-1 text-xs font-bold tabular-nums text-texte">
            {nbManques}
            <span className="sr-only"> à compléter</span>
          </span>
        )}
      </>
    );
    // Le rôle « columnheader » est sur un conteneur : sur le lien ou le bouton, il masquerait leur rôle à l'oral.
    const interieur = lienJour ? (
      <Link href={lienJour(jour)} aria-label={libelle} {...commun}>
        {contenu}
      </Link>
    ) : onOuvrirJour ? (
      <button type="button" aria-label={libelle} onClick={() => onOuvrirJour(jour)} {...commun}>
        {contenu}
      </button>
    ) : (
      <div {...commun}>{contenu}</div>
    );
    return (
      <div key={jour} role="columnheader">
        {interieur}
      </div>
    );
  };

  const ajout = (jour: string, reseau: IdReseau, creneauVide: boolean) => {
    const libelle = `Ajouter sur ${nomReseau(reseau)}, ${libelleJour(jour)}`;
    const classes = cn(AJOUT, creneauVide && "min-h-14 border-dashed border-[color:var(--c)] text-texte-doux");
    const contenu = creneauVide ? (
      <span>
        Créneau vide
        <br />+ Ajouter
      </span>
    ) : (
      "+"
    );
    return lienAjout ? (
      <Link href={lienAjout(jour, reseau)} aria-label={libelle} data-creneau-vide={creneauVide ? `${reseau}|${jour}` : undefined} className={classes}>
        {contenu}
      </Link>
    ) : (
      <button type="button" aria-label={libelle} data-creneau-vide={creneauVide ? `${reseau}|${jour}` : undefined} onClick={() => onAjouter?.(jour, reseau)} className={classes}>
        {contenu}
      </button>
    );
  };

  const carteSeule = (e: EntreeCarte) => (
    <CarteEntreeCalendrier key={e.cle} entree={e} avecTitre={avecTitre} libellesEtat={libellesEtat} verrouillee={estVerrouillee(e, aujourdhui)} tropProche={tropProches?.has(e.cle)} alerte={alertes?.get(e.cle)} href={lienEntree?.(e)} onOuvrir={onOuvrirEntree} />
  );

  const carteDe = (e: EntreeCarte) => (g && peutGlisser(e, aujourdhui) ? g.envelopper(e, jours, carteSeule(e)) : carteSeule(e));

  const voirPlus = (reseau: IdReseau, jour: string, cachees: readonly EntreeCarte[]) => {
    const reste = cachees.length;
    const libelle = `Voir ${reste === 1 ? "l'autre publication" : `les ${reste} autres publications`} sur ${nomReseau(reseau)}, ${libelleJour(jour)}`;
    const classes = "block w-full rounded-[9px] border border-dashed border-trait-fort bg-surface-1 px-1.5 py-1 text-center text-xs font-bold text-texte-doux hover:border-orange hover:text-orange-vif";
    const contenu = `+ ${reste} autre${reste > 1 ? "s" : ""}`;
    if (!aUneSortie) {
      // Sans lien ni geste : la case se déplie sur place et montre toutes ses publications (elles restent dans la page).
      return (
        <details data-plus={`${reseau}|${jour}`} className="flex flex-col gap-1">
          <summary aria-label={libelle} className={cn(classes, "flex min-h-[44px] cursor-pointer list-none items-center justify-center")}>
            {contenu}
          </summary>
          <div className="mt-1 flex flex-col gap-1">{cachees.map((e) => carteDe(e))}</div>
        </details>
      );
    }
    return lienPlus ? (
      <Link href={lienPlus(reseau, jour)} aria-label={libelle} data-plus={`${reseau}|${jour}`} className={classes}>
        {contenu}
      </Link>
    ) : (
      <button type="button" aria-label={libelle} data-plus={`${reseau}|${jour}`} onClick={() => onVoirPlus?.(reseau, jour)} className={classes}>
        {contenu}
      </button>
    );
  };

  const messageVide = filtresActifs
    ? "Aucune publication avec ces filtres."
    : passe(jours[6])
      ? "Semaine terminée : consultation seule."
      : "Rien de prévu cette semaine. Cliquez sur « + » dans un jour pour ajouter une publication.";

  return (
    <div className={className}>
      {glissable && (
        <>
          <p className="sr-only">{AIDE_GLISSER}</p>
          <div data-zone-annonce role="status" aria-live="polite" className={g?.annonce ? "mb-1 rounded-lg border border-dashed border-trait-fort bg-surface-1 px-3 py-2 text-sm text-texte" : "sr-only"}>
            {g?.annonce}
          </div>
        </>
      )}
      <div className="overflow-x-auto pb-1">
        <div role="table" aria-label="Semaine, un couloir par réseau" className="grid min-w-[880px] grid-cols-[104px_repeat(7,minmax(108px,1fr))] gap-[5px]">
          <div role="row" className="contents">
            <div role="columnheader">
              <span className="sr-only">Réseau</span>
            </div>
            {jours.map(enTete)}
          </div>
          {reseaux.map((reseau) => (
            <div key={reseau} role="row" data-couloir={reseau} style={styleReseau(reseau)} className="contents">
              <div role="rowheader" className="sticky left-0 z-[1] flex items-center gap-1.5 bg-fond px-1 py-2 text-sm font-extrabold text-texte">
                <MonogrammeReseau reseau={reseau} />
                {nomReseau(reseau)}
              </div>
              {jours.map((jour) => {
                const cartes = visibles.filter((e) => e.reseau === reseau && e.jour === jour);
                const estPasse = passe(jour);
                const estAujourdhui = jour === aujourdhui;
                const verdict = saisie ? decisionDepot({ ...saisie, jour: "" }, { reseau, jour }, aujourdhui) : null;
                const permise = Boolean(verdict?.ok);
                // Créneau attendu et encore vide : aucune vraie publication ce jour-là sur ce réseau (une idée ne compte pas).
                const creneauVide = !estPasse && cartes.length === 0 && Boolean(attendu?.(reseau, jour)) && !entrees.some((e) => e.reseau === reseau && e.jour === jour && e.etat !== "idee");
                return (
                  <div
                    key={jour}
                    role="cell"
                    data-case={`${reseau}|${jour}`}
                    data-aujourdhui={estAujourdhui ? "true" : undefined}
                    data-passe={estPasse ? "true" : undefined}
                    data-permise={saisie ? (permise ? "true" : "false") : undefined}
                    className={cn(
                      saisie && (permise ? "outline-dashed outline-2 -outline-offset-2 outline-accent" : "bg-surface-3"),
                      "relative flex min-h-[74px] min-w-0 flex-col gap-1 rounded-[11px] border p-1",
                      estAujourdhui ? "border-orange/40 bg-orange-doux" : "border-trait bg-surface-1",
                      estPasse && "bg-[repeating-linear-gradient(135deg,var(--surface-3),var(--surface-3)_6px,var(--fond)_6px,var(--fond)_12px)]",
                    )}
                  >
                    {(limite !== null && cartes.length > limite ? cartes.slice(0, limite) : cartes).map(carteDe)}
                    {limite !== null && cartes.length > limite && voirPlus(reseau, jour, cartes.slice(limite))}
                    {lienAValider &&
                      propositions
                        ?.filter((p) => p.entree.reseau === reseau && p.entree.jour === jour)
                        .map((p) => <CarteProposition key={p.entree.cle} entree={p.entree} pourquoi={p.pourquoi} ressembleA={p.ressembleA} lienAValider={lienAValider} />)}
                    {!estPasse && peutAjouter && ajout(jour, reseau, creneauVide)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {visibles.length === 0 && <div className={VIDE}>{messageVide}</div>}
      {g && g.dernier && (
        <BandeauAnnuler
          key={g.dernier.n}
          message={`Déplacée au ${libelleJour(g.dernier.vers)}.`}
          onAnnuler={g.annuler}
          onFin={g.fin}
        />
      )}
    </div>
  );
}
