import Image from "next/image";
import Link from "next/link";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import { compter, filtrerListe, FILTRES, lienDetail, lienListe, nombreAffichees, tranche, trierListe, type FiltreListe } from "./liste-a-publier";
import { regrouperParVideo } from "./regrouper-a-publier";
import type { LigneAPublier } from "@/services/a-publier";

const phraseReseaux = (n: number) => (n === 0 ? "Aucun réseau prêt" : n === 1 ? "1 réseau prêt" : `${n} réseaux prêts`);

/**
 * La liste compacte : une ligne par vidéo, rien d'autre (ni lecteur, ni champ, ni case). Un clic ouvre le détail.
 * Composant sans état : le filtre et le nombre de vidéos montrées viennent de l'adresse.
 */
export function ListeAPublier({ lignes, filtre, affichees: brut }: { lignes: LigneAPublier[]; filtre: FiltreListe; affichees?: number }) {
  const affichees = nombreAffichees(String(brut ?? ""));
  const toutes = trierListe(regrouperParVideo(lignes));
  const c = compter(toutes);
  const filtrees = filtrerListe(toutes, filtre);
  const montrees = tranche(filtrees, affichees);
  const nombres: Record<FiltreListe, number> = { "a-envoyer": c.aEnvoyer, envoyees: c.envoyees, publiees: c.publiees, toutes: c.toutes };

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-texte">
        {c.aEnvoyer} à envoyer
        {c.problemes > 0 && <span className="text-texte-doux"> · {c.problemes === 1 ? "1 problème" : `${c.problemes} problèmes`}</span>}
      </p>

      <nav aria-label="Filtrer les vidéos" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Link
            key={f.id}
            href={lienListe(f.id)}
            aria-current={f.id === filtre ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", f.id === filtre ? "border-orange bg-surface-2 text-texte" : "border-trait text-texte-doux hover:border-orange")}
          >
            {f.libelle}
            <span className="text-xs text-texte-faible">{nombres[f.id]}</span>
          </Link>
        ))}
      </nav>

      {montrees.length ? (
        <ul className="divide-y divide-trait overflow-hidden rounded-carte border border-trait bg-surface-1">
          {montrees.map(({ carte, etat }) => (
            <li key={carte.videoId}>
              <Link href={lienDetail(carte.videoId, filtre, affichees)} className="flex min-h-16 items-center gap-3 px-3 py-2 hover:bg-surface-2">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {carte.jaquette ? <Image src={carte.jaquette} alt="" fill sizes="48px" className="object-cover" /> : <Icone nom="film" size={20} className="absolute inset-0 m-auto text-texte-faible" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-texte">{carte.titre}</span>
                  <span className="block truncate text-xs text-texte-doux">
                    {carte.type ? `${carte.type} · ` : ""}
                    {phraseReseaux(carte.pretes.length)}
                  </span>
                </span>
                <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-carte border border-trait bg-surface-1 px-4 py-8 text-center text-sm text-texte-doux">
          {filtre === "a-envoyer" ? "Rien à envoyer pour le moment." : "Aucune vidéo dans cette liste."}
          {filtre !== "toutes" && c.toutes > 0 && (
            <>
              {" "}
              <Link href={lienListe("toutes")} className="font-semibold text-orange-vif">
                Voir toutes les vidéos
              </Link>
            </>
          )}
        </p>
      )}

      {filtrees.length > montrees.length && (
        <div className="space-y-2 text-center">
          <p className="text-xs text-texte-faible">
            {montrees.length} vidéos sur {filtrees.length}
          </p>
          <Link href={lienListe(filtre, affichees + 20)} className="inline-flex min-h-11 items-center rounded-full border border-trait px-5 text-sm font-semibold text-texte hover:border-orange">
            Voir 20 de plus
          </Link>
        </div>
      )}
    </div>
  );
}
