"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { choisirAccrochesAction, choisirAngleAction, reprendreEcritureArreteeAction, reprendreEcrituresAction } from "@/app/(studio)/ecrire/sujets/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";
import { Icone } from "@/components/ui/Icone";
import { BarreProgression } from "@/components/ui/ProgressionEtapes";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { MESSAGE_AUCUN_COMPTE_CLAUDE } from "@/domaine/credits";
import { cn } from "@/lib/cn";

/** Ce que l'écran d'attente reçoit (lu par `etatEcriture`). */
export interface EtatEcritureAffiche {
  statut: string | null;
  etape: number;
  libelle: string;
  /** Étapes de la chaîne qui écrit (chaîne courte : 1 à 4) ; absentes : celles de la grande chaîne. */
  etapes?: number[];
  utiliseEur: string;
  medianeMin: number | null;
  pause?: "choisir-angle" | "choisir-accroches";
  angles?: { titre: string; probleme: string }[];
  accroches?: { id: string; dit: string; famille: string }[];
  message?: string;
  /** Paquet 4 (D3) : écriture lancée en essai, elle le reste jusqu'au bout (rien n'est payé). */
  essai?: boolean;
  /** Comptes Claude d'abonnement : rien à « recharger », on attend le renouvellement. */
  abonnements?: boolean;
  aucunCompte?: boolean;
  /** Relecture finale G1 : montant supplémentaire possible de « Reprendre l'écriture » (déjà mis en forme). */
  supplement?: string;
  /**
   * Garde-fous budget (15/10, corrigé après relecture) : « Reprendre » d'une écriture en attente ou au plafond. Possible :
   * prix (au plus, mis en forme) et ses centimes, renvoyés comme accord ; sinon la raison, dite à la place d'un prix.
   */
  reprise?: { possible: true; prix: string; centimes: number } | { possible: false; raison: string };
  /** Écriture arrêtée qui ne peut pas reprendre : pourquoi (le bouton le dit au lieu de proposer la reprise). */
  bloque?: string;
}

const ETAPES = [1, 2, 3, 4, 6, 8, 9, 12];

/**
 * Écran d'attente d'une écriture (B.3.4 n° 10, B.6) : où en est l'écriture, ce qui est déjà utilisé, la durée médiane
 * MESURÉE ; la page se rafraîchit seule. En « je choisis », la pause propose les angles puis les accroches.
 */
export function EcritureEnCours({ id, etat }: { id: string; etat: EtatEcritureAffiche }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [choisies, setChoisies] = useState<string[]>([]);
  const attend = etat.statut === "en-cours";

  useEffect(() => {
    if (!attend) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [attend, router]);

  const etapes = etat.etapes?.length ? etat.etapes : ETAPES;
  const fait = etapes.filter((n) => n <= etat.etape).length;

  if (etat.pause === "choisir-angle" && etat.angles?.length) {
    return (
      <section aria-label="Choisir l'angle" className="space-y-3">
        <h2 className="text-2xl text-texte">Quel angle ?</h2>
        {etat.angles.map((a, i) => (
          <button
            key={i}
            type="button"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await choisirAngleAction(id, i);
                if (!r.ok) notifier.erreur(r.message);
                router.refresh();
              })
            }
            className="block w-full rounded-carte border border-trait bg-surface-1 p-4 text-left hover:border-orange"
          >
            <span className="block text-[17px] font-semibold leading-snug text-texte">{a.titre}</span>
            <span className="mt-1 block text-sm text-texte-doux">{a.probleme}</span>
          </button>
        ))}
      </section>
    );
  }

  if (etat.pause === "choisir-accroches" && etat.accroches?.length) {
    return (
      <section aria-label="Choisir les accroches" className="space-y-3">
        <h2 className="text-2xl text-texte">Vos 3 accroches</h2>
        <ul className="space-y-2">
          {etat.accroches.map((a) => {
            const pris = choisies.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-pressed={pris}
                  onClick={() => setChoisies((x) => (pris ? x.filter((y) => y !== a.id) : x.length < 3 ? [...x, a.id] : x))}
                  className={cn("flex w-full items-start gap-3 rounded-carte border p-4 text-left", pris ? "border-orange bg-orange-doux" : "border-trait bg-surface-1")}
                >
                  <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold", pris ? "border-orange bg-orange text-sur-orange" : "border-trait-fort text-texte-faible")}>{pris ? choisies.indexOf(a.id) + 1 : ""}</span>
                  <span className="text-[15px] font-semibold leading-snug text-texte">{a.dit}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Bouton
          taille="lg"
          pleineLargeur
          icone="coche"
          disabled={!choisies.length}
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await choisirAccrochesAction(id, choisies);
              if (!r.ok) notifier.erreur(r.message);
              router.refresh();
            })
          }
        >
          Continuer
        </Bouton>
      </section>
    );
  }

  return (
    <Carte lueur className="text-center">
      <span className={cn("mx-auto mb-4 grid size-14 place-items-center rounded-2xl", attend ? "bg-orange-doux text-orange-vif" : "bg-ambre-doux text-ambre")}>
        <Icone nom={attend ? "ecrire" : "sablier"} size={26} className={cn(attend && "animate-pulse")} />
      </span>
      <h2 className="text-2xl text-texte">{attend ? etat.libelle : etat.statut === "echec" ? "Écriture arrêtée" : "En attente"}</h2>
      {etat.message && <p className="mt-2 text-[15px] text-texte-doux">{etat.message}</p>}
      {(etat.statut === "en-attente-credit" || etat.statut === "plafond-atteint") && etat.reprise && !etat.reprise.possible && (
        <>
          <p className="mt-2 text-sm text-texte-faible">{etat.reprise.raison}</p>
          <Bouton className="mt-4" pleineLargeur icone="repeter" disabled>
            Reprendre : pas possible pour l&apos;instant
          </Bouton>
        </>
      )}
      {(etat.statut === "en-attente-credit" || etat.statut === "plafond-atteint") && etat.reprise?.possible && (
        <Bouton
          className="mt-4"
          pleineLargeur
          icone="repeter"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const prix = etat.reprise?.possible ? etat.reprise.centimes : undefined;
              // Le prix montré part comme accord ; plus haut au moment de reprendre, la feuille « Confirmer ce prix » le redemande.
              const r = await avecConfirmationPrix(await reprendreEcrituresAction(id, prix), (accord) => reprendreEcrituresAction(id, accord));
              if (!r.ok) {
                if (r.code !== "CONFIRMATION_REQUISE") notifier.erreur(r.message);
              } else if (!r.donnees) notifier.erreur(etat.aucunCompte ? MESSAGE_AUCUN_COMPTE_CLAUDE : etat.abonnements ? "Toujours bloquée : attendez le renouvellement des comptes Claude ou relevez la limite du mois." : "Toujours bloquée : rechargez Claude ou relevez la limite du mois.");
              else notifier.succes("L'écriture reprend");
              router.refresh();
            })
          }
        >
          {etat.reprise.centimes > 0 ? `Reprendre (≈ ${etat.reprise.prix})` : "Reprendre"}
        </Bouton>
      )}
      {etat.statut === "echec" && (
        <>
          <p className="mt-2 text-sm text-texte-faible">Ce qui est déjà écrit est gardé ; les autres sujets continuent.</p>
          {etat.bloque && <p className="mt-2 text-sm text-texte-faible">{etat.bloque}</p>}
          <Bouton
            disabled={!!etat.bloque}
            className="mt-4"
            pleineLargeur
            icone="repeter"
            chargement={enCours}
            onClick={() =>
              demarrer(async () => {
                // Relecture finale G1 : le supplément possible passe par la feuille « Confirmer ce prix ».
                const r = await avecConfirmationPrix(await reprendreEcritureArreteeAction(id), (accord) => reprendreEcritureArreteeAction(id, accord));
                if (!r.ok) {
                  if (r.code !== "CONFIRMATION_REQUISE") notifier.erreur(r.message);
                } else notifier.succes("L'écriture reprend");
                router.refresh();
              })
            }
          >
            {etat.supplement ? `Reprendre l'écriture (jusqu'à ${etat.supplement} de plus)` : "Reprendre l'écriture"}
          </Bouton>
        </>
      )}
      <BarreProgression className="mt-5" valeur={Math.round((fait / etapes.length) * 100)} libelle="Avancement de l'écriture" />
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-texte-doux">
          <Icone nom="euro" size={12} />
          {etat.utiliseEur} utilisés
        </span>
        {etat.medianeMin !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-texte-doux">
            <Icone nom="horloge" size={12} />
            environ {etat.medianeMin} min
          </span>
        )}
        {etat.essai && <PastilleEssai className="self-center" />}
      </div>
    </Carte>
  );
}
