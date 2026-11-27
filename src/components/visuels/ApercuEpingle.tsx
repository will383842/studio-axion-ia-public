/**
 * Aperçu d'une épingle avant envoi (PR 7) : image 2:3, titre, description, texte alternatif, hôte du lien, tableau.
 * Lecture seule : ne publie rien, ne modifie rien. `imageUrl` est une adresse lue par le serveur à la demande (jamais
 * une adresse signée gardée). Le texte alternatif est montré en clair, pas seulement posé en attribut ; chaque
 * problème est dit en mots avec une icône, jamais par la couleur seule. Couleurs : jetons du thème seulement.
 */
import type { ReactNode } from "react";
import { DESCRIPTION_MAX, TITRE_MAX, hoteDuLien, limitesEpingle, tronquer } from "@/domaine/epingles/apercu";

export interface ProprietesApercuEpingle {
  imageUrl: string | null;
  titre: string;
  description: string;
  texteAlternatif: string;
  lien: string;
  tableau: string;
  contenuIA: boolean;
  /** Domaine exigé à l'envoi (`site.domaine`) : le lien est vérifié par la même fonction que l'envoi. */
  domaine?: string | null;
}

export function ApercuEpingle({ imageUrl, titre, description, texteAlternatif, lien, tableau, contenuIA, domaine }: ProprietesApercuEpingle): ReactNode {
  const problemes = limitesEpingle({ titre, description, texteAlternatif, lien, domaine });
  const hote = hoteDuLien(lien);
  return (
    <figure aria-label="Aperçu de l'épingle" className="flex max-w-xs flex-col gap-2 rounded-champ border border-trait bg-surface-1 p-3 text-texte">
      <div style={{ aspectRatio: "2 / 3" }} className="w-full overflow-hidden rounded-champ border border-trait bg-surface-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- adresse lue à la demande par le serveur, sans optimisation
          <img src={imageUrl} alt={texteAlternatif} loading="lazy" className="size-full object-cover" />
        ) : (
          <p className="flex size-full items-center justify-center p-3 text-center text-sm text-texte-doux">Image indisponible</p>
        )}
      </div>
      <figcaption className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-texte-doux">Tableau : {tableau}</p>
        <p className="text-base font-bold text-texte">{tronquer(titre, TITRE_MAX)}</p>
        <p className="whitespace-pre-line text-sm text-texte-doux">{tronquer(description, DESCRIPTION_MAX)}</p>
        <p className="text-sm text-texte-doux">Lien : {hote ?? "illisible"}</p>
        {contenuIA && <p className="text-sm font-bold text-texte">Mention « modifié par IA » affichée par Pinterest</p>}
        <p className="text-sm text-texte-doux">
          <span className="font-bold">Texte alternatif :</span> {texteAlternatif.trim() ? texteAlternatif : "—"}
        </p>
      </figcaption>
      {problemes.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-champ border border-trait-fort bg-surface-2 px-3 py-2 text-sm text-texte">
          {problemes.map((p) => (
            <li key={p.code}>
              <span aria-hidden>⚠ </span>
              {p.phrase}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
