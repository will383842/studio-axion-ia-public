import Link from "next/link";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { plageSemaine } from "@/lib/calendrier-plages";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";
import type { TableLibelles } from "./PastilleStatutPlan";
import { libelleJour } from "./BarreVue";
import { CarteEntreeCalendrier, MonogrammeReseau, estVerrouillee, jourLisible, nomReseau, styleReseau, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";

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
  className?: string;
}

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const VIDE = "mt-2 rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-sm text-texte-doux";
const AJOUT = "mt-auto grid min-h-[30px] place-items-center rounded-[9px] border-[1.5px] border-dashed border-trait-fort p-1 text-center text-xs font-bold text-texte-faible hover:border-orange hover:text-orange-vif";

/**
 * Semaine en couloirs : une ligne par réseau, une colonne par jour (lundi d'abord), sans lignes d'heures.
 * Aujourd'hui est marqué ; les jours passés sont hachurés et sans « + ».
 */
export function GrilleSemaine({ semaineDu, aujourdhui, entrees, reseaux = RESEAUX_CALENDRIER, lienEntree, onOuvrirEntree, lienJour, onOuvrirJour, lienAjout, onAjouter, attendu, maxParCase, densite, lienPlus, onVoirPlus, libellesEtat, tropProches, alertes, manquesParJour, aCompleter, filtresActifs, className }: ProprietesGrilleSemaine) {
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

  const carteDe = (e: EntreeCarte) => (
    <CarteEntreeCalendrier key={e.cle} entree={e} avecTitre={avecTitre} libellesEtat={libellesEtat} verrouillee={estVerrouillee(e, aujourdhui)} tropProche={tropProches?.has(e.cle)} alerte={alertes?.get(e.cle)} href={lienEntree?.(e)} onOuvrir={onOuvrirEntree} />
  );

  const voirPlus = (reseau: IdReseau, jour: string, cachees: readonly EntreeCarte[]) => {
    const reste = cachees.length;
    const libelle = `Voir ${reste === 1 ? "l'autre publication" : `les ${reste} autres publications`} sur ${nomReseau(reseau)}, ${libelleJour(jour)}`;
    const classes = "block w-full rounded-[9px] border border-dashed border-trait-fort bg-surface-1 px-1.5 py-1 text-center text-xs font-bold text-texte-doux hover:border-orange hover:text-orange-vif";
    const contenu = `+ ${reste} autre${reste > 1 ? "s" : ""}`;
    if (!aUneSortie) {
      // Sans lien ni geste : la case se déplie sur place et montre toutes ses publications (elles restent dans la page).
      return (
        <details data-plus={`${reseau}|${jour}`} className="flex flex-col gap-1">
          <summary aria-label={libelle} className={cn(classes, "cursor-pointer list-none")}>
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
                // Créneau attendu et encore vide : aucune vraie publication ce jour-là sur ce réseau (une idée ne compte pas).
                const creneauVide = !estPasse && cartes.length === 0 && Boolean(attendu?.(reseau, jour)) && !entrees.some((e) => e.reseau === reseau && e.jour === jour && e.etat !== "idee");
                return (
                  <div
                    key={jour}
                    role="cell"
                    data-case={`${reseau}|${jour}`}
                    data-aujourdhui={estAujourdhui ? "true" : undefined}
                    data-passe={estPasse ? "true" : undefined}
                    className={cn(
                      "relative flex min-h-[74px] min-w-0 flex-col gap-1 rounded-[11px] border p-1",
                      estAujourdhui ? "border-orange/40 bg-orange-doux" : "border-trait bg-surface-1",
                      estPasse && "bg-[repeating-linear-gradient(135deg,var(--surface-3),var(--surface-3)_6px,var(--fond)_6px,var(--fond)_12px)]",
                    )}
                  >
                    {(limite !== null && cartes.length > limite ? cartes.slice(0, limite) : cartes).map(carteDe)}
                    {limite !== null && cartes.length > limite && voirPlus(reseau, jour, cartes.slice(limite))}
                    {!estPasse && peutAjouter && ajout(jour, reseau, creneauVide)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {visibles.length === 0 && <div className={VIDE}>{messageVide}</div>}
    </div>
  );
}
