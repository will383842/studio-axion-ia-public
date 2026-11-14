import { Icone } from "@/components/ui/Icone";
import { controlerPretAPartir, type CodeControle, type OptionsControle, type PublicationAControler } from "@/services/pret-a-partir";

export interface ProprietesPretAPartir extends OptionsControle {
  /** Une publication par réseau choisi. */
  publications: readonly PublicationAControler[];
  /** Geste du bouton « Copier » (rendu client) : reçoit le texte à copier. */
  onCopier?: (texte: string) => void;
  /** Points que les données de l'entrée ne portent pas (média décrit, premier commentaire, mot) : au lieu d'un « il manque » inventé, la ligne dit « à vérifier à la main ». */
  averifier?: readonly CodeControle[];
}

const A_VERIFIER: Partial<Record<CodeControle, string>> = {
  fichier: "Le fichier (vidéo, image ou PDF) est à vérifier à la main.",
  "premier-commentaire": "Le premier commentaire est à vérifier à la main.",
  mot: "Le mot à commenter est à vérifier à la main.",
};

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts" };

/** Liste « Prêt à partir ? » du tiroir : ce qui manque, réseau par réseau. Informe, n'empêche rien. */
export function PretAPartir({ publications, mots, onCopier, averifier = [] }: ProprietesPretAPartir) {
  const blocs = publications.map((p) => ({
    p,
    lignes: [
      ...controlerPretAPartir(p, { mots }).filter((l) => !averifier.includes(l.code)),
      // Pas de premier commentaire sur TikTok : rien à vérifier de ce côté.
      ...averifier.filter((code) => A_VERIFIER[code] && !(code === "premier-commentaire" && p.reseau === "tiktok")).map((code) => ({ code, message: A_VERIFIER[code] as string, copier: undefined as string | undefined })),
    ],
  }));
  return (
    <section aria-label="Prêt à partir ?" className="rounded-xl border border-trait bg-surface-1 p-3 text-sm text-texte">
      <h3 className="mb-2 font-extrabold">Prêt à partir ?</h3>
      {blocs.every((b) => b.lignes.length === 0) && <p className="text-texte-doux">Tout est prêt : rien ne manque.</p>}
      {blocs.filter((b) => b.lignes.length > 0).map(({ p, lignes }) => (
        <div key={p.reseau} data-reseau={p.reseau} className="mb-2 last:mb-0">
          <h4 className="font-bold">{NOMS[p.reseau] ?? p.reseau}</h4>
          <ul className="mt-1 space-y-1">
            {lignes.map((l) => (
              <li key={l.code} className="flex items-start gap-1.5 text-texte-doux">
                <Icone nom="attention" size={14} />
                <span>{l.message}</span>
                {l.copier && (
                  <button type="button" onClick={onCopier ? () => onCopier(l.copier as string) : undefined} className="ml-auto rounded-md border border-trait-fort bg-surface-2 px-2 py-0.5 text-xs font-bold text-texte hover:bg-surface-3">
                    Copier
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
