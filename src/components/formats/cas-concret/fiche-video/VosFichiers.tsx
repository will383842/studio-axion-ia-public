/**
 * « VOS FICHIERS » (tâche U2, plan § 7) : une ligne par réseau (nom, durée, dimensions, phrase de la fin, télécharger,
 * copier le texte, copier le lien, où poser le lien), « Le premier commentaire », « Vérifications », « Ce que la vidéo a
 * coûté ». Reçoit la vue toute faite (`vueCasConcret`). AUCUN bouton de publication ni de programmation.
 * Vidéo d'essai : la pastille « Essai… », ni lien ni texte à copier.
 */
import { BoutonLienPrive, type LienPriveVideo } from "@/components/partage/BoutonLienPrive";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import type { FichierReseauCasConcret, VueCasConcret } from "@/services/cas-concret-vue";

/** « 52 s » (arrondi à la seconde). */
const duree = (sec: number): string => `${Math.round(sec)} s`;

function LigneReseau({ f, essai }: { f: FichierReseauCasConcret; essai: boolean }) {
  return (
    <li className="list-none space-y-2 border-t border-trait py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[17px] font-semibold text-texte">{f.nom}</span>
        <span className="text-sm text-texte-doux">
          {[f.dureeSec ? duree(f.dureeSec) : null, f.dimensions].filter(Boolean).join(" · ")}
        </span>
      </div>
      {f.phraseFin && <p className="text-sm text-texte-doux">{f.phraseFin}</p>}
      {f.raisonFin && <p className="text-sm text-texte-faible">{f.raisonFin}</p>}
      <div className="flex flex-wrap gap-2">
        {f.url && (
          <Bouton asChild variante="secondaire" icone="telecharger">
            <a href={f.url} download>
              Télécharger
            </a>
          </Bouton>
        )}
        {!essai && f.texte && <BoutonCopier texte={f.texte} libelle="Copier le texte" />}
        {!essai && f.lien && <BoutonCopier texte={f.lien} libelle="Copier le lien" />}
      </div>
      {!essai && f.consigneLien && <p className="text-sm text-texte-doux">Où poser le lien : {f.consigneLien}</p>}
    </li>
  );
}

export function VosFichiers({ vue, lienPrive }: { vue: VueCasConcret; lienPrive?: LienPriveVideo }) {
  const commentaire = vue.essai ? undefined : vue.fichiers.find((f) => f.premierCommentaire)?.premierCommentaire;
  return (
    <section aria-label="Vos fichiers" className="mt-6 space-y-4">
      {lienPrive && <BoutonLienPrive {...lienPrive} />}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl text-texte">Vos fichiers</h2>
        {vue.essai && <Pastille ton="ambre">Essai : cas à confirmer par Will, ne pas publier</Pastille>}
      </div>
      {vue.documentAPreparer && !vue.essai && !vue.documentOuvert && <p className="text-[15px] text-texte">Document promis : à préparer avant de publier.</p>}
      <Carte>
        <ul>
          {vue.fichiers.map((f) => (
            <LigneReseau key={f.reseau} f={f} essai={vue.essai} />
          ))}
        </ul>
      </Carte>
      {commentaire && (
        <Carte>
          <h3 className="mb-2 text-sm font-semibold text-texte-doux">Le premier commentaire</h3>
          <p className="mb-3 whitespace-pre-line text-[15px] text-texte">{commentaire}</p>
          <BoutonCopier texte={commentaire} libelle="Copier le commentaire" />
        </Carte>
      )}
      {vue.rapport && (
        <Carte>
          <h3 className="mb-2 text-sm font-semibold text-texte-doux">Vérifications</h3>
          <p className="text-[15px] text-texte">{vue.rapport.resume}</p>
          {vue.rapport.phrases.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-texte-doux">
              {vue.rapport.phrases.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Carte>
      )}
      <Carte>
        <h3 className="mb-1 text-sm font-semibold text-texte-doux">Ce que la vidéo a coûté</h3>
        <p className="text-[17px] font-semibold text-texte">{vue.cout}</p>
      </Carte>
    </section>
  );
}
