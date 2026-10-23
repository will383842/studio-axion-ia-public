"use client";

/**
 * « MA VIDÉO HEYGEN » (lot R7, décision de Will du 03/10) — Will fait la vidéo avec son double dans l'application
 * HeyGen, puis la rattache ici à sa version ; « Monter ma prise » fait ensuite la finition. Secours : déposer le
 * fichier téléchargé depuis HeyGen. Mots simples, rien de payant.
 * Aperçu NEUTRE (icône, titre, date, durée) : les images d'aperçu de HeyGen ne sont pas autorisées par la politique
 * de contenu du studio, qui n'est pas ouverte à un domaine entier (relecture sécurité n° 7). L'hôte EXACT des
 * aperçus sera ajouté après le premier essai réel (docs/OUTILS-REELS-R7.md, « Corrections sécurité »).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { listerVideosHeygenAction, rattacherFichierHeygenAction, rattacherVideoHeygenAction } from "@/app/(studio)/ecrire/sujets/actions";
import { Bouton, EtatVide, FeuilleBas, Icone, notifier, Pastille, ZoneDepot } from "@/components/ui";
import type { VideoHeygenAffichee } from "@/services/videos-heygen";
import { formateurDate } from "@/lib/intl";

type Liste = { branche: boolean; videos: VideoHeygenAffichee[] };

/** « 3 oct., 14:05 · 1 min 12 s » (PUR, testé). */
export function legendeVideo(v: Pick<VideoHeygenAffichee, "creeLe" | "dureeSec">): string {
  const morceaux: string[] = [];
  if (v.creeLe) morceaux.push(formateurDate("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(v.creeLe)));
  if (v.dureeSec) {
    const s = Math.round(v.dureeSec);
    morceaux.push(s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`);
  }
  return morceaux.join(" · ");
}

export function BoutonVideoHeygen({ sujetId, varianteId, code }: { sujetId: string; varianteId: string; code: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [liste, setListe] = useState<Liste | null>(null);
  const [enCours, demarrer] = useTransition();

  function ouvrir() {
    setOuverte(true);
    demarrer(async () => {
      const r = await listerVideosHeygenAction();
      if (!r.ok) return void notifier.erreur(r.message);
      setListe(r.donnees);
    });
  }

  function fini() {
    notifier.succes("Vidéo rattachée", "« Monter ma prise » ajoute les sous-titres, le son et la miniature.");
    setOuverte(false);
    router.refresh();
  }

  function rattacher(v: VideoHeygenAffichee) {
    demarrer(async () => {
      const r = await rattacherVideoHeygenAction(sujetId, varianteId, v.idExterne);
      if (!r.ok) return void notifier.erreur(r.message);
      fini();
    });
  }

  function deposee(fichiers: { fichierId: string }[]) {
    const f = fichiers[0];
    if (!f) return;
    demarrer(async () => {
      const r = await rattacherFichierHeygenAction(sujetId, varianteId, f.fichierId);
      if (!r.ok) return void notifier.erreur(r.message);
      fini();
    });
  }

  return (
    <>
      <Bouton variante="secondaire" icone="film" onClick={ouvrir}>
        Ma vidéo HeyGen
      </Bouton>
      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="Ma vidéo HeyGen" description={`Faite avec votre double dans l'application HeyGen, rattachée à ${code}.`}>
        <div className="grid gap-5">
          <ListeVideos liste={liste} enCours={enCours} onRattacher={rattacher} />
          <section aria-label="Vidéo absente de la liste" className="grid gap-2">
            <p className="text-sm font-semibold text-texte">Elle n&apos;est pas dans la liste ?</p>
            <p className="text-sm text-texte-doux">Téléchargez-la depuis l&apos;application HeyGen, puis déposez-la ici.</p>
            <ZoneDepot libelle="Déposer ma vidéo HeyGen" accepte="video/*" icone="film" multiple={false} essai={false} onFichiers={() => undefined} envoi={{ typeEntite: "rush", entiteId: varianteId, onEnvoyes: deposee, onErreur: (m) => notifier.erreur(m) }} />
          </section>
        </div>
      </FeuilleBas>
    </>
  );
}

export function ListeVideos({ liste, enCours, onRattacher }: { liste: Liste | null; enCours: boolean; onRattacher: (v: VideoHeygenAffichee) => void }) {
  if (!liste) return <p className="text-sm text-texte-faible">{enCours ? "Lecture de vos vidéos HeyGen…" : ""}</p>;
  if (!liste.branche) return <EtatVide compact icone="film" titre="HeyGen n'est pas encore relié" phrase="Déposez ci-dessous la vidéo téléchargée depuis HeyGen." />;
  if (!liste.videos.length) return <EtatVide compact icone="film" titre="Aucune vidéo dans votre compte" phrase="Faites votre vidéo dans l'application HeyGen, puis revenez ici." />;
  return (
    <ul className="grid gap-2">
      {liste.videos.map((v) => (
        <li key={v.idExterne} className="flex flex-wrap items-center gap-3 rounded-carte border border-trait bg-surface-2 p-3">
          <span className="grid h-16 w-12 shrink-0 place-items-center rounded-champ bg-surface-3 text-texte-doux">
            <Icone nom="film" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-texte">{v.titre}</span>
            <span className="block text-sm text-texte-faible">{legendeVideo(v)}</span>
            {v.raison && <span className="block text-sm text-texte-faible">{v.raison}</span>}
          </span>
          {v.rattacheeA ? (
            <Pastille ton="sauge" icone="coche">
              Rattachée à {v.rattacheeA}
            </Pastille>
          ) : v.terminee ? (
            <Bouton chargement={enCours} onClick={() => onRattacher(v)}>
              Rattacher
            </Bouton>
          ) : (
            <Pastille ton="ambre">Pas encore prête</Pastille>
          )}
        </li>
      ))}
    </ul>
  );
}
