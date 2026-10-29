import Image from "next/image";
import Link from "next/link";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import type { LigneAPublier } from "@/services/a-publier";
import { FILTRES, nombreAffichees, TRANCHE, tranche, type FiltreListe } from "./liste-a-publier";
import { compteursParReseau, deCeReseau, filtrerReseau, lienDetailReseau, lienListeReseau, lignesParReseau, reseauDepuis, reseauxPresents, sectionsParReseau, type ReseauListe } from "./liste-par-reseau";
/**
 * La liste compacte, séparée par réseau : une ligne par vidéo POUR CE RÉSEAU (miniature, titre, état de ce réseau, format).
 * Une vidéo prévue pour deux réseaux apparaît dans les deux. Composant sans état : réseau, filtre et nombre de vidéos viennent de l'adresse.
 */
export function ListeAPublier({ lignes, filtre, affichees: brut, reseau: reseauBrut }: { lignes: LigneAPublier[]; filtre: FiltreListe; affichees?: number; reseau?: string }) {
  const affichees = nombreAffichees(String(brut ?? ""));
  const presents = reseauxPresents(lignes);
  const reseau = reseauDepuis(reseauBrut, presents);
  const toutes = lignesParReseau(lignes);
  const parReseau = compteursParReseau(toutes, presents);
  const choisies = deCeReseau(toutes, reseau);
  const c = parReseau[reseau];
  const filtrees = filtrerReseau(choisies, filtre);
  const nombres: Record<FiltreListe, number> = { "a-envoyer": c.aEnvoyer, envoyees: c.envoyees, publiees: c.publiees, problemes: c.problemes, toutes: c.toutes };
  const sections = reseau === "tous" ? sectionsParReseau(filtrees, presents) : [{ reseau, lignes: filtrees }];

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-texte">
        {c.aEnvoyer} à envoyer
        {reseau !== "tous" && <span className="text-texte-doux"> sur {obtenirReseau(reseau).nom}</span>}
        {c.problemes > 0 && (
          <span className="text-texte-doux">
            {" · "}
            <Link href={lienListeReseau(reseau, "problemes")} className="font-semibold text-orange-vif">
              {c.problemes === 1 ? "1 problème" : `${c.problemes} problèmes`}
            </Link>
          </span>
        )}
      </p>

      <nav aria-label="Choisir un réseau" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {(["tous", ...presents] as ReseauListe[]).map((r) => {
          const n = parReseau[r];
          return (
            <Link
              key={r}
              href={lienListeReseau(r, filtre)}
              aria-current={r === reseau ? "page" : undefined}
              className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold", r === reseau ? "border-orange bg-surface-2 text-texte" : "border-trait text-texte-doux hover:border-orange")}
            >
              {r !== "tous" && <LogoReseau reseau={r} taille="sm" />}
              {r === "tous" ? "Tous" : obtenirReseau(r).nom}
              <span className="text-xs font-normal text-texte-faible">{n.aEnvoyer > 0 ? `${n.aEnvoyer} à envoyer` : n.toutes}</span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Filtrer les vidéos" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Link
            key={f.id}
            href={lienListeReseau(reseau, f.id)}
            aria-current={f.id === filtre ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", f.id === filtre ? "border-orange bg-surface-2 text-texte" : "border-trait text-texte-doux hover:border-orange")}
          >
            {f.libelle}
            <span className="text-xs text-texte-faible">{nombres[f.id]}</span>
          </Link>
        ))}
      </nav>

      {filtrees.length ? (
        sections.map((s) => {
          const montrees = tranche(s.lignes, affichees);
          return (
            <section key={s.reseau} aria-label={obtenirReseau(s.reseau).nom} className="space-y-2">
              {reseau === "tous" && (
                <h2 className="flex items-center gap-2 text-sm font-semibold text-texte">
                  <LogoReseau reseau={s.reseau} taille="sm" />
                  {obtenirReseau(s.reseau).nom}
                  <span className="text-xs font-normal text-texte-faible">{s.lignes.length}</span>
                </h2>
              )}
              <ul className="divide-y divide-trait overflow-hidden rounded-carte border border-trait bg-surface-1">
                {montrees.map(({ ligne, etat, format }) => (
                  <li key={ligne.cle}>
                    <Link href={lienDetailReseau(ligne.videoId, ligne.reseau, filtre, affichees, reseau === "tous")} className="flex min-h-16 items-center gap-3 px-3 py-2 hover:bg-surface-2">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                        {ligne.jaquette ? <Image src={ligne.jaquette} alt="" fill sizes="48px" className="object-cover" /> : <Icone nom="film" size={20} className="absolute inset-0 m-auto text-texte-faible" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-texte">{ligne.titre}</span>
                        <span className="block truncate text-xs text-texte-doux">
                          {[ligne.typeVideo, format, etat.raison].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Pastille ton={etat.ton}>{etat.libelle}</Pastille>
                    </Link>
                  </li>
                ))}
              </ul>
              {s.lignes.length > montrees.length && (
                <div className="space-y-2 text-center">
                  <p className="text-xs text-texte-faible">
                    {montrees.length} vidéos sur {s.lignes.length}
                  </p>
                  <Link href={lienListeReseau(reseau, filtre, affichees + TRANCHE)} className="inline-flex min-h-11 items-center rounded-full border border-trait px-5 text-sm font-semibold text-texte hover:border-orange">
                    Voir 20 de plus
                  </Link>
                </div>
              )}
            </section>
          );
        })
      ) : (
        <p className="rounded-carte border border-trait bg-surface-1 px-4 py-8 text-center text-sm text-texte-doux">
          {filtre === "a-envoyer" ? "Rien à envoyer pour le moment." : "Aucune vidéo dans cette liste."}
          {filtre !== "toutes" && c.toutes > 0 && (
            <>
              {" "}
              <Link href={lienListeReseau(reseau, "toutes")} className="font-semibold text-orange-vif">
                Voir toutes les vidéos
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
