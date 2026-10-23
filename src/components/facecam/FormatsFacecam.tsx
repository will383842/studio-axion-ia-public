"use client";

/**
 * FORMATS DE LA VIDÉO (face caméra, lot F1) : une seule ligne de pastilles sous « Votre vidéo ». Le 9:16 est toujours
 * fait. 10/10 :
 *   - un format DÉJÀ PRÊT s'ouvre dans le lecteur, sans confirmation (le toucher ne le retire plus) ;
 *   - un format pas encore fabriqué demande d'abord « Fabriquer le format Carré ? environ N min, gratuit » : c'est un
 *     calcul lourd (passe image sur la prise 4K, 10 à 20 min), il ne part plus sur un simple toucher ;
 *   - un format coché pas encore prêt se décoche comme avant.
 * Aucun prix : le reste se dit au monteur (« fais-moi aussi une version pour YouTube », « retire la version carrée »).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changerFormatsFacecamAction } from "@/app/(studio)/videos/actions-formats-facecam";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { FormeRatio, SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { EVENEMENT_LIRE_FORMAT } from "@/components/videos/LecteurVersions";
import type { RatioFacecam } from "@/briques/formats-facecam";
import type { PastilleFormatVue, VueFormatsFacecam } from "@/services/formats-facecam";

const ETATS = { faite: "Prête · lire", "en-cours": "En cours…", "a-faire": "Avec la vidéo" } as const;

/** « environ 15 min, gratuit » (estimation du studio ; sans elle : « quelques minutes »). */
export function phraseDureeFormat(minutes: number | undefined): string {
  return minutes ? `Environ ${minutes} min de calcul, gratuit.` : "Quelques minutes de calcul, gratuit.";
}

export function FormatsFacecam({ videoId, vue, possible }: { videoId: string; vue: VueFormatsFacecam; possible: boolean }) {
  const router = useRouter();
  const [choisis, setChoisis] = useState<RatioFacecam[]>(vue.pastilles.filter((p) => p.coche).map((p) => p.ratio));
  const [envoi, demarrer] = useTransition();
  const [aConfirmer, setAConfirmer] = useState<{ pastille: PastilleFormatVue; liste: RatioFacecam[] } | null>(null);

  function envoyer(liste: RatioFacecam[], ajoute?: RatioFacecam) {
    const avant = choisis;
    setChoisis(liste);
    demarrer(async () => {
      const r = await changerFormatsFacecamAction(videoId, liste);
      if (!r.ok) {
        setChoisis(avant);
        notifier.erreur(r.message);
        return;
      }
      const p = ajoute ? vue.pastilles.find((x) => x.ratio === ajoute) : null;
      notifier.succes(p ? `Format ${p.nom.toLowerCase()} en route` : "Formats mis à jour", p ? `${phraseDureeFormat(p.minutesEstimees)} Il arrive à côté de la vidéo.` : undefined);
      router.refresh();
    });
  }

  function changer(suivants: RatioFacecam[]) {
    if (!possible || envoi) return;
    // Le 9:16 reste toujours coché : c'est la vidéo de référence.
    const liste = vue.pastilles.map((p) => p.ratio).filter((r) => r === "9:16" || suivants.includes(r));
    const ajoute = liste.find((r) => !choisis.includes(r));
    const retire = choisis.find((r) => !liste.includes(r));
    // Un format déjà prêt (ou le 9:16) s'ouvre dans le lecteur : on ne le retire pas d'un toucher.
    const touche = vue.pastilles.find((p) => p.ratio === (retire ?? ajoute));
    if (touche && (touche.verrouille || touche.etat === "faite")) {
      window.dispatchEvent(new CustomEvent(EVENEMENT_LIRE_FORMAT, { detail: { ratio: touche.ratio } }));
      return;
    }
    if (liste.length === choisis.length && liste.every((r) => choisis.includes(r))) return;
    // Un format pas encore fabriqué : calcul lourd, confirmation d'abord.
    const nouveau = ajoute ? vue.pastilles.find((p) => p.ratio === ajoute) : undefined;
    if (nouveau) {
      setAConfirmer({ pastille: nouveau, liste });
      return;
    }
    envoyer(liste);
  }

  return (
    <>
      <SelecteurPastilles
        multiple
        defilement
        libelle="Formats de la vidéo"
        valeur={choisis}
        onChange={changer}
        options={vue.pastilles.map((p) => {
          const coche = choisis.includes(p.ratio);
          const etat = coche ? (p.coche ? p.etat : envoi ? "en-cours" : undefined) : undefined;
          return {
            valeur: p.ratio,
            libelle: p.nom,
            detail: etat ? ETATS[etat] : p.usage,
            visuel: <FormeRatio ratio={p.ratio} />,
            ...(!possible ? { desactive: true, raison: "Disponible quand la vidéo est prête." } : {}),
          };
        })}
      />
      <Dialogue
        ouvert={!!aConfirmer}
        onOuvertChange={(v) => !v && setAConfirmer(null)}
        titre={aConfirmer ? `Fabriquer le format ${aConfirmer.pastille.nom.toLowerCase()} ?` : "Fabriquer ce format ?"}
        description={`${phraseDureeFormat(aConfirmer?.pastille.minutesEstimees)} La vidéo est recadrée pour ce format, sous-titres et cartes compris ; elle arrive à côté de celle-ci.`}
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setAConfirmer(null)}>
              Annuler
            </Bouton>
            <Bouton
              icone="coche"
              chargement={envoi}
              onClick={() => {
                const c = aConfirmer;
                setAConfirmer(null);
                if (c) envoyer(c.liste, c.pastille.ratio);
              }}
            >
              Fabriquer
            </Bouton>
          </>
        }
      />
    </>
  );
}
