"use client";

import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { DUREE_MAX_SEC } from "@/moteurs/montage-video-longue";
import { formaterDuree } from "./PlanChapitres";

export const PHRASE_PLUS_DE_20_MIN = "Votre script dépasse 20 minutes de lecture : raccourcissez-le ou coupez-le en deux vidéos.";

/**
 * Écran 4 : ce que la vidéo utilisera, SANS aucun montant. L'accord est explicite ; au-delà de 20 minutes, une alerte
 * remplace le bouton de lancement (la même borne que le lancement). Si le générateur est éteint ou si les dépenses sont
 * coupées dans les réglages, il n'y a pas de bouton de lancement, seulement un lien vers les réglages.
 */
export function AvantDeLancer({
  dureeSec,
  chapitres,
  courts,
  sansVoix = false,
  peutLancer,
  enCours = false,
  lance = false,
  phraseBloquee,
  onLancer,
  onRetour,
}: {
  dureeSec: number;
  chapitres: number;
  /** Nombre de vidéos courtes en plus ; 0 = case décochée, rien n'est affiché. */
  courts: number;
  /** Mode « Sans voix » : pas de voix, aucun crédit de voix. */
  sansVoix?: boolean;
  peutLancer: boolean;
  /** Envoi en cours : bouton remplacé par « Lancement en cours… ». */
  enCours?: boolean;
  /** Vidéo déjà lancée : ni bouton ni lien vers les réglages. */
  lance?: boolean;
  /** Phrase affichée à la place du bouton quand le mode choisi n'est pas disponible. */
  phraseBloquee?: string;
  onLancer: () => void;
  onRetour: () => void;
}) {
  const tropLong = dureeSec > DUREE_MAX_SEC;
  return (
    <section className="space-y-5" aria-label="Avant de lancer">
      <Carte className="space-y-3">
        <h3 className="text-base font-semibold text-texte">{sansVoix ? "Cette vidéo n'utilise aucun crédit de voix" : "Cette vidéo utilise vos crédits"}</h3>
        <ul className="space-y-1.5 text-sm text-texte">
          {sansVoix ? <li>Sans voix : sous-titres et texte à l&apos;écran, environ {formaterDuree(dureeSec)}, aucun coût</li> : <li>Voix de votre double : environ {formaterDuree(dureeSec)}</li>}
          <li>{chapitres} chapitre{chapitres > 1 ? "s" : ""}</li>
          <li>Format large</li>
          {courts > 0 && <li>{courts} vidéo{courts > 1 ? "s" : ""} courte{courts > 1 ? "s" : ""} en plus : pas encore fabriquée{courts > 1 ? "s" : ""}</li>}
        </ul>
        <p className="text-sm text-texte-doux">
          {sansVoix ? "Aucune voix, aucune musique : rien n'est payé." : "Rien n'est payé avant votre accord. Si le montant du jour change, le Studio s'arrête et vous redemande."}
        </p>
      </Carte>
      <div className="flex flex-wrap items-center gap-3">
        {enCours ? (
          <p role="status" className="text-sm text-texte">Lancement en cours…</p>
        ) : lance ? null : tropLong ? (
          <>
            <p role="alert" className="text-sm font-semibold text-texte">{PHRASE_PLUS_DE_20_MIN}</p>
            <Bouton type="button" icone="baguette" disabled>
              Je donne mon accord et je lance la vidéo
            </Bouton>
          </>
        ) : phraseBloquee ? (
          <p role="status" className="text-sm font-semibold text-texte">{phraseBloquee}</p>
        ) : peutLancer ? (
          <Bouton type="button" icone="baguette" onClick={onLancer}>
            Je donne mon accord et je lance la vidéo
          </Bouton>
        ) : (
          <Link href="/reglages" className="inline-flex min-h-11 items-center rounded-full border border-trait-fort px-4 text-sm font-semibold text-accent hover:bg-accent-doux">
            Ouvrir les réglages
          </Link>
        )}
        <Bouton type="button" variante="secondaire" onClick={onRetour}>
          Pas maintenant
        </Bouton>
      </div>
    </section>
  );
}
