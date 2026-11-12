import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { exigerSession } from "@/services/auth";
import { listerContenusARanger, RESEAUX_RANGEMENT } from "@/services/rangement-contenus";
import { dependancesCarrousels } from "@/visuels/services/production";
import { rangerContenuAction } from "./actions";

export const metadata: Metadata = { title: "À ranger" };
export const dynamic = "force-dynamic";

const NOMS_RESEAUX: Record<(typeof RESEAUX_RANGEMENT)[number], string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" };
const NOMS_FAMILLES = { carrousel: "Carrousel", "carrousel-continu": "Carrousel continu", infographie: "Image" } as const;
const PHRASES_ERREURS: Record<string, string> = {
  INTROUVABLE: "Ce contenu n'existe plus.",
  RESEAU_INVALIDE: "Ce réseau n'est pas proposé.",
  DEJA_RANGE: "Ce contenu a déjà son réseau.",
};

/**
 * « À RANGER » (D3-07) : les carrousels et images sans réseau. Un geste (le bouton du réseau) les range ; rejouer le même
 * geste ne change rien. /videos/a-ranger reste l'écran des vidéos.
 */
export default async function PageContenusARanger({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigerSession();
  const sp = await searchParams;
  const code = typeof sp.erreur === "string" ? sp.erreur : undefined;
  const message = code === undefined ? undefined : Object.hasOwn(PHRASES_ERREURS, code) ? PHRASES_ERREURS[code] : "Un souci est survenu. Réessayez dans un instant.";
  const contenus = await listerContenusARanger(dependancesCarrousels());
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={{ href: "/contenus", libelle: "Tous mes contenus" }}
        titre="À ranger"
        sousTitre={`${contenus.length} contenu${contenus.length > 1 ? "s" : ""} sans réseau`}
        className="mb-4"
      />
      {message && <p role="alert" className="mb-3 rounded-carte border border-trait bg-brique-doux p-3 text-sm text-brique">{message}</p>}
      {sp.range === "1" && !message && <p role="status" className="mb-3 rounded-carte border border-trait bg-sauge-doux p-3 text-sm text-sauge">Contenu rangé.</p>}
      {!contenus.length ? (
        <EtatVide icone="archive" titre="Tout est rangé" phrase="Chaque carrousel et chaque image a son réseau." />
      ) : (
        <ul className="space-y-2">
          {contenus.map((c) => (
            <li key={c.id} className="rounded-carte border border-trait bg-surface-1 p-3">
              <span className="line-clamp-2 font-semibold leading-snug text-texte">{c.titre}</span>
              <span className="block text-xs text-texte-faible">{NOMS_FAMILLES[c.famille]}</span>
              <form action={rangerContenuAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={c.id} />
                {RESEAUX_RANGEMENT.map((r) => (
                  <button key={r} type="submit" name="reseau" value={r} className="inline-flex min-h-11 items-center rounded-full bg-accent-doux px-3 text-sm font-semibold text-accent">
                    Ranger sous {NOMS_RESEAUX[r]}
                  </button>
                ))}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
