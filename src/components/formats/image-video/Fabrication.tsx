"use client";

/**
 * ÉCRAN 4 · LA FABRICATION (lot L16, plan § 8). Les étapes, une par bloc, avec leur état (faite, en cours, à venir,
 * arrêtée) et la dépense : ce qui est engagé face au plafond de la vidéo, et la voix réellement payée. L'écran se relit
 * seul toutes les quelques secondes tant que la fabrication avance. Un arrêt dit quoi en une phrase et propose
 * « Refaire cette partie » (seule l'étape arrêtée repart ; ce qui est payé reste). Règle du 25/10/2026 : le prix ne bloque
 * jamais et rien ne demande d'accorder un prix ; aucun montant n'est affiché.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { PrevenirTelephone } from "@/components/fabrication/PrevenirTelephone";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { messageSansMontant } from "@/components/ui/ConfirmationPrix";
import { notifier } from "@/components/ui/Toast";
import { BoutonArreter } from "@/components/videos/BoutonArreter";
import type { Montant } from "@/domaine/types";
import { refaireCettePartie } from "./reprise";
import type { VueFabrication } from "./vue";
import { etatSuiviIV, versSuiviFabricationIV } from "./vues-gabarit";

/** Relecture de l'avancement (ms). */
const RELECTURE_MS = 4000;

export function Fabrication({
  videoId,
  vue,
  enCours,
  ecran,
  plafond,
  arret,
  arretee,
}: {
  videoId: string;
  vue: VueFabrication;
  enCours: boolean;
  ecran: string;
  /** Arrêt sur le plafond : « Refaire cette partie » relève au montant proposé puis reprend, sans saisie. */
  plafond?: { proposeCentimes: number; arrete: boolean };
  /** Présent seulement si l'arrêt est tenu (travail du studio en cours, pas le lanceur) : sinon pas de bouton « Arrêter ». */
  arret?: { travailId: string; depense: Montant };
  /** Fabrication arrêtée par Will. */
  arretee?: boolean;
}) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);

  // Tant que la fabrication avance, l'écran relit son état ; la page ne se recharge que si quelque chose a changé.
  const signature = JSON.stringify(vue);
  useEffect(() => {
    if (!enCours) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/image-video/${encodeURIComponent(videoId)}`, { cache: "no-store" });
        const v = (await r.json().catch(() => null)) as { vue?: { ecran?: string; enCours?: boolean; fabrication?: unknown } } | null;
        if (v?.vue && (v.vue.ecran !== ecran || !v.vue.enCours || JSON.stringify(v.vue.fabrication) !== signature)) router.refresh();
      } catch {
        // Connexion coupée : nouvel essai au prochain tour.
      }
    }, RELECTURE_MS);
    return () => clearInterval(t);
  }, [enCours, videoId, ecran, signature, router]);

  async function refaire() {
    if (occupe) return;
    setOccupe(true);
    setPhrase(null);
    try {
      const fin = await refaireCettePartie(videoId, plafond);
      if (fin) return setPhrase(fin);
      notifier.succes("C'est reparti");
      router.refresh();
    } finally {
      setOccupe(false);
    }
  }

  const etat = etatSuiviIV({ enCours, arretee, vue });
  // Le refus du moteur dit sa phrase dans le titre ; l'arrêt de Will, ce qui est payé. Le détail du refus reste sous les étapes.
  const message = vue.refus && !enCours && !arretee ? messageSansMontant(vue.refus.phrase) : arretee && !enCours ? "Fabrication arrêtée : seules les étapes déjà faites ont été payées." : undefined;
  const peutRefaire = vue.refus?.reessayable && !enCours;
  return (
    <section aria-label="La fabrication" className="space-y-6">
      <EnTeteSuivi etat={etat} message={message} sansTemps />
      {enCours && <PrevenirTelephone />}

      {vue.pas.length > 0 && <SuiviFabrication vue={versSuiviFabricationIV(vue)} />}

      <ActionsSuivi
        etat={etat}
        arreter={enCours && arret ? <BoutonArreter travailId={arret.travailId} videoId={videoId} depense={arret.depense} /> : undefined}
        propres={
          arretee && !enCours ? (
            <Link href="/videos" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-orange underline">
              Voir mes vidéos
            </Link>
          ) : undefined
        }
      />

      {vue.attente && <p className="text-sm text-texte-doux">Le rendu tourne sur nos serveurs : la suite reprend seule.</p>}


      {vue.refus && (vue.refus.details.length > 0 || arretee) && (
        <Carte className="border-brique">
          {arretee && <p className="mb-2 text-sm text-texte">{messageSansMontant(vue.refus.phrase)}</p>}
          <ul className="list-disc space-y-1 pl-5 text-sm text-texte-doux">
            {vue.refus.details.map((d) => (
              <li key={d}>{messageSansMontant(d)}</li>
            ))}
          </ul>
        </Carte>
      )}

      <ActionsSuivi
        etat={etat}
        reprendre={
          peutRefaire ? (
            <Bouton variante="secondaire" icone="reessayer" chargement={occupe} onClick={() => void refaire()}>
              Refaire cette partie
            </Bouton>
          ) : undefined
        }
      />

      {phrase && (
        <p role="alert" className="text-sm text-brique">
          {messageSansMontant(phrase)}
        </p>
      )}
    </section>
  );
}
