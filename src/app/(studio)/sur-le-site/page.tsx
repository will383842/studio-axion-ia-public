import type { Metadata } from "next";
import Link from "next/link";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { LigneSurLeSite } from "@/components/videos/fiche/LigneSurLeSite";
import { exigerSession } from "@/services/auth";
import { listerEnLigne } from "@/services/site-videos";

export const metadata: Metadata = { title: "Sur le site" };
export const dynamic = "force-dynamic";

/**
 * Ce qui est sur le site, par type de vidéo (lot S3 ; habillage R8a, maquette M5). Les vues restent « — » tant que le site
 * ne les remonte pas : une note le dit une fois en haut, et chaque ligne porte sa pastille « pas encore disponibles ».
 */
export default async function PageSurLeSite() {
  await exigerSession();
  const groupes = await listerEnLigne();
  return (
    <div className="space-y-6">
      <EnTetePage surTitre="Publier" titre="Sur le site" sousTitre="Les vidéos visibles sur le site, rangées par type de vidéo." className="mb-2" />
      {groupes.length === 0 ? (
        <EtatVide
          compact
          icone="lien"
          titre="Rien n'est encore sur le site"
          phrase="Cochez « Sur le site » dans une vidéo, relisez, puis publiez."
          action={
            <Bouton asChild variante="secondaire">
              <Link href="/videos">Voir mes vidéos</Link>
            </Bouton>
          }
        />
      ) : (
        <>
          <p className="flex items-start gap-2 rounded-carte bg-surface-2 p-3 text-sm text-texte-doux">
            <Icone nom="info" size={18} className="mt-0.5 shrink-0 text-texte-faible" />
            <span>
              <b className="text-texte">Le nombre de vues n&apos;est pas encore disponible.</b> Il s&apos;affichera ici, à côté de chaque vidéo, dès que le site l&apos;enverra au Studio. Vous n&apos;avez rien à faire.
            </span>
          </p>
          {groupes.map((g) => (
            <Carte key={g.formatId} as="section" aria-labelledby={`site-${g.formatId}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`site-${g.formatId}`} className="font-titre text-lg text-texte">
                  {g.nom}
                </h2>
                <small className="text-sm text-texte-faible">
                  {g.videos.length} {g.videos.length > 1 ? "vidéos" : "vidéo"}
                </small>
              </div>
              <ul className="mt-2 divide-y divide-trait">
                {g.videos.map((v) => (
                  <LigneSurLeSite key={v.videoId} ligne={v} />
                ))}
              </ul>
            </Carte>
          ))}
        </>
      )}
    </div>
  );
}
