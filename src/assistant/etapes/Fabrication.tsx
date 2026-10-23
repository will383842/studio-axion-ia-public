"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { reessayerTravailAction } from "@/app/(studio)/actions";
import { useNotificationsTelephone } from "@/components/coquille/EnregistrementPwa";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { versSuiviFabrication } from "@/components/creation/vues-travail";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Icone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { Squelette } from "@/components/ui/Squelette";
import { notifier } from "@/components/ui/Toast";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { BoutonArreter } from "@/components/videos/BoutonArreter";
import { travailAffiche, useTravaux } from "@/hooks/useTravaux";
import { formatSansPrix } from "@/formats";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";
import type { ProprietesEtape } from "./types";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

/**
 * Étape « fabrication » — PLEIN ÉCRAN : progression en direct (useTravaux, toutes les 2 s),
 * étapes qui se cochent, « Réessayer cette étape » en cas d'échec, puis « Voir la vidéo ».
 * Lot M1b : minutes restantes et heure de fin, dépense en direct, « Arrêter » ; « Vous pouvez fermer :
 * on vous prévient » seulement quand la boucle de fond tourne (la fabrication continue téléphone fermé).
 */
export function EtapeFabrication({ brouillon }: ProprietesEtape) {
  const [reessai, setReessai] = useState(false);
  // TEST-UI-REEL U7 (CORRECTEUR UI2) : on suit aussi la DERNIÈRE fabrication de la vidéo (sans identifiant, ou après la
  // fin) : l'écran ne reste plus sur des blocs gris quand la vidéo est déjà prête.
  const { travaux, charge } = useTravaux({
    travailId: brouillon.travailId,
    videoId: brouillon.videoId,
    onTermine: () => notifier.succes("Votre vidéo est prête"),
  });
  const t = travailAffiche(travaux, brouillon.travailId, brouillon.videoId);
  const termine = t?.statut === "termine";
  const echec = t?.statut === "echec";
  const actif = t?.statut === "en_cours" || t?.statut === "en_file";
  const arretee = t?.statut === "annule";
  const telephone = useNotificationsTelephone();
  // Face caméra : aucun montant, ni sous le suivi ni dans « Arrêter ».
  const sansPrix = formatSansPrix(brouillon.formatId);

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-fond">
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[60dvh] transition-opacity duration-700", termine ? "lueur-forte" : "lueur", echec && "opacity-0")} />
      <header className="relative mx-auto flex w-full max-w-xl items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href="/" aria-label="Revenir à l'accueil" className="-ml-2 grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-2 hover:text-texte">
          <Icone nom="fermer" size={20} />
        </Link>
        <span className="truncate text-sm font-semibold text-texte-doux">{brouillon.titre || brouillon.sujet}</span>
        <PastilleEssai className="ml-auto" />
      </header>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6 pt-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-6 grid size-28 place-items-center">
            <AnimatePresence mode="wait">
              {termine ? (
                <motion.span key="fini" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} className="grid size-28 place-items-center rounded-full bg-sauge text-fond shadow-carte">
                  <Icone nom="coche" size={52} strokeWidth={2.6} />
                </motion.span>
              ) : echec ? (
                <motion.span key="echec" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid size-28 place-items-center rounded-full bg-brique-doux text-brique">
                  <Icone nom="attention" size={44} />
                </motion.span>
              ) : (
                <motion.span key="encours" className="relative grid size-28 place-items-center">
                  <motion.span className="absolute inset-0 rounded-full border-4 border-orange/20 border-t-orange" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
                  <span className="grid size-20 place-items-center rounded-full bg-orange text-sur-orange shadow-orange">
                    <Icone nom="clap" size={34} />
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <EnTetePage
            className="mb-0 items-center text-center sm:flex-col sm:items-center sm:justify-center"
            titre={termine ? "Votre vidéo est prête" : echec ? "Une étape a coincé" : arretee ? "Fabrication arrêtée" : "Je fabrique votre vidéo"}
            sousTitre={termine ? "Elle vous attend dans Mes vidéos." : echec || arretee ? "Rien n'est perdu." : t?.boucleActive ? "Vous pouvez fermer : on vous prévient." : "Quelques minutes de patience."}
          />
          {actif && t?.boucleActive && telephone.etat === "a-activer" && (
            <Bouton
              variante="fantome"
              icone="cloche"
              className="mt-2"
              onClick={async () => {
                if (await telephone.activer()) notifier.succes("C'est noté", "Ce téléphone sera prévenu.");
              }}
            >
              Me prévenir sur ce téléphone
            </Bouton>
          )}
        </div>

        {t ? (
          <SuiviFabrication
            vue={versSuiviFabrication(t)}
            pied={!sansPrix && t.depense.centimes > 0 ? <>{formaterMontant(t.depense)} dépensés</> : undefined}
            actions={
              actif ? (
                <>
                  <BoutonArreter travailId={t.id} videoId={t.cibleId} depense={sansPrix ? undefined : t.depense} compact />
                  <BoutonAnnuler videoId={t.cibleId} travailId={t.id} depense={sansPrix ? undefined : t.depense} compact apres="/videos" />
                </>
              ) : termine ? undefined : (
                <BoutonAnnuler videoId={t.cibleId} compact apres="/videos" />
              )
            }
            reessaiEnCours={reessai}
            onReessayer={async () => {
              setReessai(true);
              let r = await reessayerTravailAction(t.id);
              r = await avecConfirmationPrix(r, (accord) => reessayerTravailAction(t.id, accord));
              setReessai(false);
              if (!r.ok) notifier.erreur(r.message);
            }}
          />
        ) : charge ? (
          <SansSuivi videoId={brouillon.videoId} />
        ) : (
          <div className="space-y-3" aria-busy="true">
            <Squelette className="h-12 w-32" />
            <Squelette className="h-2 w-full rounded-full" />
            {[0, 1, 2, 3].map((i) => (
              <Squelette key={i} className="h-11 w-full" />
            ))}
          </div>
        )}

        {termine && t?.vignette && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="relative mx-auto mt-8 aspect-[9/16] w-40 overflow-hidden rounded-carte border border-trait shadow-carte">
            <Image src={t.vignette} alt="" fill sizes="160px" className="object-cover" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-fond/60 text-texte backdrop-blur">
                <Icone nom="lecture" size={20} className="translate-x-0.5" fill="currentColor" />
              </span>
            </span>
          </motion.div>
        )}
      </div>

      {/* Au bureau, la barre devient statique : on la garde dans la colonne centrée, comme avant (pas sur toute la largeur). */}
      <BarreActionCollee auDessusDesOnglets={false} className="lg:mx-auto lg:w-full lg:max-w-xl lg:px-4 lg:pb-6">
        {termine && brouillon.videoId ? (
          <Bouton asChild taille="lg" pleineLargeur iconeDroite="fleche-droite">
            <Link href={`/videos/${brouillon.videoId}`}>Voir la vidéo</Link>
          </Bouton>
        ) : (
          <Bouton asChild taille="lg" variante="secondaire" pleineLargeur icone="accueil">
            <Link href="/">Revenir à l&apos;accueil</Link>
          </Bouton>
        )}
      </BarreActionCollee>
    </div>
  );
}

/**
 * TEST-UI-REEL U7 : aucun travail à suivre pour cette vidéo (réponse reçue, rien trouvé) : plus de blocs gris sans fin,
 * la fiche de la vidéo dit où elle en est.
 */
export function SansSuivi({ videoId }: { videoId?: string }) {
  return (
    <div className="rounded-carte border border-trait bg-surface-1 p-4 text-center">
      <p className="text-[15px] text-texte">Le suivi de cette fabrication n&apos;est plus affiché ici.</p>
      <p className="mt-1 text-sm text-texte-doux">Votre vidéo vous attend dans Mes vidéos, prête ou en cours.</p>
      {videoId && (
        <Bouton asChild taille="lg" pleineLargeur className="mt-4" iconeDroite="fleche-droite">
          <Link href={`/videos/${videoId}`}>Voir ma vidéo</Link>
        </Bouton>
      )}
    </div>
  );
}
