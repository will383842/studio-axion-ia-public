"use client";

/**
 * Média de l'aperçu (CAL-03) : une vidéo se lit (lecteur avec son), un carrousel se feuillette page par page (une seule
 * image chargée à la fois), une infographie s'ouvre en grand sans quitter la page. Le type se lit par une icône ET un
 * libellé, jamais par la couleur seule. Ne publie rien. Couleurs : jetons du thème seulement.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Icone } from "@/components/ui/Icone";
import { TYPES_CONTENU } from "./CarteEntreeCalendrier";

export interface ProprietesApercuMedia {
  type: "video" | "carrousel" | "infographie";
  /** Lien de lecture de la vidéo ou de l'infographie (signé, fourni par l'appelant). */
  url?: string | null;
  poster?: string | null;
  /** Carrousel : un lien d'image par page, dans l'ordre (rendues à l'import, voir services/pdf-pages). */
  pages?: readonly string[];
}

const BOUTON = "min-h-[38px] rounded-[10px] border border-trait-fort bg-surface-2 px-3 py-1.5 text-sm font-bold text-texte hover:bg-surface-3 disabled:opacity-50";

export function ApercuMedia({ type, url, poster, pages = [] }: ProprietesApercuMedia): ReactNode {
  const [page, setPage] = useState(0);
  const [grand, setGrand] = useState(false);
  const t = TYPES_CONTENU[type];
  const total = pages.length;
  const courante = Math.min(page, Math.max(0, total - 1));

  const etiquette = (
    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-texte">
      <Icone nom={t.icone} aria-hidden="true" />
      <span>{t.libelle}</span>
    </p>
  );

  const aller = (n: number) => setPage(Math.max(0, Math.min(total - 1, n)));
  const surTouche = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      aller(courante + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      aller(courante - 1);
    }
  };

  if (type === "video") {
    return (
      <section aria-label="Vidéo">
        {etiquette}
        {url ? (
          <video controls preload="metadata" poster={poster ?? undefined} src={url} className="max-h-[60vh] w-full rounded-[10px] bg-voile">
            Votre navigateur ne sait pas lire cette vidéo.
          </video>
        ) : (
          <p role="status">La vidéo n&apos;est pas encore disponible à la lecture.</p>
        )}
      </section>
    );
  }

  if (type === "carrousel") {
    return (
      <section aria-label="Carrousel" onKeyDown={surTouche}>
        {etiquette}
        {total === 0 ? (
          <p role="status">Les pages ne sont pas encore prêtes : le carrousel pourra être feuilleté dans un instant.</p>
        ) : (
          <>
            <img src={pages[courante]} alt={`Carrousel, page ${courante + 1} sur ${total}`} className="max-h-[60vh] w-full rounded-[10px] bg-voile object-contain" />
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={BOUTON} disabled={courante === 0} onClick={() => aller(courante - 1)}>Page précédente</button>
              <p role="status" aria-live="polite">Page {courante + 1} sur {total}</p>
              <button type="button" className={BOUTON} disabled={courante >= total - 1} onClick={() => aller(courante + 1)}>Page suivante</button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Infographie">
      {etiquette}
      {url ? (
        <>
          <img src={url} alt="Infographie de la publication" className="max-h-[60vh] w-full rounded-[10px] bg-voile object-contain" />
          <button type="button" className={BOUTON} onClick={() => setGrand(true)}>Agrandir l&apos;infographie</button>
          {grand && (
            <div
              role="dialog"
              aria-modal={true}
              aria-label="Infographie en taille réelle"
              className="fixed inset-0 z-50 overflow-auto bg-voile p-4"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setGrand(false);
                }
              }}
            >
              <button type="button" className={BOUTON} onClick={() => setGrand(false)}>Fermer</button>
              <img src={url} alt="Infographie en taille réelle" className="mx-auto h-auto max-w-none" />
            </div>
          )}
        </>
      ) : (
        <p role="status">L&apos;infographie n&apos;est pas encore disponible.</p>
      )}
    </section>
  );
}
