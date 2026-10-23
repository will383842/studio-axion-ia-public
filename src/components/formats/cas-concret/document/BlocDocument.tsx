/**
 * Bloc « Document promis » de la fiche d'une vidéo : l'état en clair (« Brouillon » ou « Validé le … ») et le lien vers
 * la page du document. Lecture seule, rien n'est envoyé. S'ajoute à la fiche par une seule ligne :
 * `<BlocDocument videoId={…} />` (composant serveur ; ne rend rien si la vidéo n'a pas de document).
 */
import Link from "next/link";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { lireDocument } from "@/services/cas-concret-document";
import { jourFrancais } from "./jour";

export async function BlocDocument({ videoId }: { videoId: string }) {
  let vue: Awaited<ReturnType<typeof lireDocument>>;
  try {
    vue = await lireDocument(videoId);
  } catch {
    return null;
  }
  return (
    <Carte aria-label="Document promis">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-texte-doux">Document promis</h3>
          <p className="text-[15px] text-texte">{vue.document.titre}</p>
        </div>
        {vue.valideLe ? <Pastille ton="sauge">Validé le {jourFrancais(vue.valideLe)}</Pastille> : <Pastille ton="ambre">Brouillon</Pastille>}
      </div>
      <Link href={`/cas-concret/document/${videoId}`} className="mt-3 inline-block text-[15px] font-medium text-texte underline">
        {vue.valideLe ? "Ouvrir le document" : "Relire et valider le document"}
      </Link>
    </Carte>
  );
}
