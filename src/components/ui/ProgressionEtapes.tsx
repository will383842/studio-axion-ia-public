"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MESSAGE_AUCUN_COMPTE_CLAUDE } from "@/domaine/credits";
import type { EtapeTravail, Montant, StatutEtape } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import { Bouton } from "./Bouton";
import { Icone, type NomIcone } from "./Icone";

/** État de chaque étape, dit en toutes lettres (lecteurs d'écran). */
const ETAT_ETAPE: Record<StatutEtape, string> = {
  terminee: "terminée",
  en_cours: "en cours",
  en_attente: "à venir",
  echec: "à reprendre",
  ignoree: "passée",
};

/** Barre de progression simple. */
export function BarreProgression({
  valeur,
  ton = "orange",
  libelle = "Avancement",
  className,
}: {
  valeur: number;
  ton?: "orange" | "brique" | "sauge";
  /** Nom lu par les lecteurs d'écran (ex. « Avancement de « Mon titre » »). */
  libelle?: string;
  className?: string;
}) {
  return (
    <div role="progressbar" aria-label={libelle} aria-valuenow={valeur} aria-valuemin={0} aria-valuemax={100} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <motion.div
        className={cn("h-full rounded-full", ton === "orange" && "bg-orange", ton === "brique" && "bg-brique", ton === "sauge" && "bg-sauge")}
        initial={false}
        animate={{ width: `${Math.max(2, valeur)}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/** Suivi en direct (lot M1b, B.9 ter) : temps restant en minutes et heure de fin, dépense, file d'attente, panne d'un outil. */
export interface SuiviProgression {
  resteMin?: number;
  heureFin?: string;
  depense?: Montant;
  rang?: number;
  debutVers?: string;
  enAttenteFournisseur?: boolean;
  /** Lot « crédits » : nom du fournisseur dont le crédit manque (« en attente de crédit »). */
  attenteCredit?: string;
  /** Claude est en mode « abonnements » : l'attente se lève au renouvellement du compte, pas par une recharge. */
  abonnementsClaude?: boolean;
  /** Mode « abonnements » sans aucun compte utilisable : on dit de poser une clé, pas de recharger. */
  aucunCompteClaude?: boolean;
}

/** « encore 3 min · fin vers 15 h 40 » ; en file : « 2ᵉ dans la file · début vers 15 h 40 ». */
export function texteTemps(s: SuiviProgression & { resteSec?: number }): string | null {
  if (s.rang) return `${s.rang === 1 ? "1ʳᵉ" : `${s.rang}ᵉ`} dans la file${s.debutVers ? ` · début vers ${s.debutVers}` : ""}`;
  const minutes = s.resteMin ?? (s.resteSec !== undefined ? Math.max(1, Math.ceil(s.resteSec / 60)) : undefined);
  if (minutes === undefined) return null;
  return `encore ${minutes} min${s.heureFin ? ` · fin vers ${s.heureFin}` : ""}`;
}

/**
 * Progression d'un travail à étapes (Voix → Double → Montage…). Mise à jour par useTravaux.
 * L'étape en échec affiche son message pour Will et « Reprendre » (ne relance qu'elle).
 * `suivi` : minutes restantes, heure de fin, dépense en direct, rang dans la file, bandeau « outil ralenti ».
 */
export function ProgressionEtapes({
  etapes,
  progression,
  resteSec,
  suivi,
  action,
  onReessayer,
  reessaiEnCours,
  message,
  compacte,
  aRelire,
  className,
}: {
  etapes: EtapeTravail[];
  progression: number;
  /** Ancien affichage en secondes : converti en minutes. */
  resteSec?: number;
  suivi?: SuiviProgression;
  /** Action à droite du temps (« Arrêter »). */
  action?: ReactNode;
  onReessayer?: () => void;
  reessaiEnCours?: boolean;
  /** Phrase visible quand une action du suivi a échoué (jamais un clic muet). */
  message?: string | null;
  compacte?: boolean;
  /** Clé de l'étape arrêtée pour que Will relise (le script à valider) : une étape « À relire », pas un échec. */
  aRelire?: string;
  className?: string;
}) {
  const echec = etapes.find((e) => e.statut === "echec" && e.cle !== aRelire);
  // À relire : rien ne tourne, aucun temps restant n'est annoncé.
  const temps = !echec && !aRelire && progression < 100 ? texteTemps({ ...suivi, resteSec }) : null;
  return (
    <div className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <span className={cn("font-titre tabular-nums leading-none", compacte ? "text-3xl" : "text-5xl", echec ? "text-brique" : "text-texte")}>
          {progression}
          <span className="text-[0.5em] text-texte-doux"> %</span>
        </span>
        <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          {temps && <span className="text-sm tabular-nums text-texte-doux">{temps}</span>}
          {suivi?.depense && suivi.depense.centimes > 0 && <span className="text-xs tabular-nums text-texte-faible">{formaterMontant(suivi.depense)} dépensés</span>}
        </span>
      </div>
      <BarreProgression valeur={progression} ton={echec ? "brique" : progression >= 100 ? "sauge" : "orange"} />
      {suivi?.attenteCredit && !echec && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-brique/30 bg-brique-doux px-3 py-2 text-sm text-texte">
          <Icone nom="euro" size={16} className="mt-0.5 shrink-0 text-brique" />
          <span>
            {/* Claude en mode abonnements : un abonnement se renouvelle, il ne se recharge pas. */}
            {suivi.attenteCredit === "Claude" && suivi.aucunCompteClaude ? MESSAGE_AUCUN_COMPTE_CLAUDE : suivi.attenteCredit === "Claude" && suivi.abonnementsClaude ? "En attente de crédit Claude : la fabrication reprendra au renouvellement du compte." : `En attente de crédit ${suivi.attenteCredit}. Rechargez : la fabrication reprendra toute seule.`}{" "}
            <Link href="/reglages#credits" className="font-semibold text-orange-vif underline-offset-2 hover:underline">
              Crédits
            </Link>
          </span>
        </p>
      )}
      {suivi?.enAttenteFournisseur && !echec && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-ambre/30 bg-ambre-doux px-3 py-2 text-sm text-texte">
          <Icone nom="horloge" size={16} className="mt-0.5 shrink-0 text-ambre" />
          Un outil est ralenti. La fabrication reprendra toute seule.
        </p>
      )}
      {action && <div className="mt-3 flex justify-end">{action}</div>}
      {message && (
        <p role="alert" className="mt-3 text-sm text-brique">
          {message}
        </p>
      )}
      <ol className={cn("mt-4 grid gap-1", compacte ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {etapes.map((e) => {
          const relire = e.cle === aRelire && e.statut === "echec";
          const statut = relire ? "en_attente" : e.statut;
          return (
          <li key={e.cle} aria-current={relire || e.statut === "en_cours" ? "step" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-2", (relire || statut === "en_cours") && "bg-surface-2", statut === "echec" && "bg-brique-doux")}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300",
                statut === "terminee" && "bg-sauge-doux text-sauge",
                statut === "en_cours" && "bg-orange text-sur-orange",
                relire && "bg-ambre-doux text-ambre",
                statut === "en_attente" && !relire && "bg-surface-2 text-texte-faible",
                statut === "echec" && "bg-brique text-sur-orange",
                statut === "ignoree" && "bg-surface-2 text-texte-faible opacity-50",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={relire ? "a-relire" : statut} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.18 }}>
                  <Icone
                    nom={relire ? "oeil" : statut === "terminee" ? "coche" : statut === "echec" ? "attention" : (e.icone as NomIcone)}
                    size={16}
                    className={statut === "en_cours" ? "animate-pulse" : undefined}
                  />
                </motion.span>
              </AnimatePresence>
            </span>
            <span className={cn("flex-1 text-sm font-semibold", statut === "en_attente" && !relire ? "text-texte-faible" : "text-texte")}>
              {e.nom}
              {/* L'état ne se lit pas qu'à la couleur : il est dit aux lecteurs d'écran. */}
              <span className="sr-only">, {relire ? "à relire" : ETAT_ETAPE[statut]}</span>
            </span>
            {relire && <span className="shrink-0 rounded-full bg-ambre-doux px-2.5 py-1 text-xs font-semibold text-texte">À relire</span>}
            {statut === "en_cours" && <span className="text-xs tabular-nums text-texte-doux">{e.progression} %</span>}
          </li>
          );
        })}
      </ol>
      {echec && (
        <div className="mt-4 flex flex-col gap-3 rounded-carte border border-brique/30 bg-brique-doux p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-texte">{echec.erreur?.messagePourWill ?? "Cette étape n'a pas abouti."}</p>
          {onReessayer && echec.erreur?.reessayable !== false && (
            <Bouton variante="secondaire" icone="reessayer" onClick={onReessayer} chargement={reessaiEnCours}>
              Reprendre cette étape
            </Bouton>
          )}
        </div>
      )}
    </div>
  );
}
