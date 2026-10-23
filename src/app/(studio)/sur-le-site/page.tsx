import type { Metadata } from "next";
import { Carte } from "@/components/ui/Carte";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { LigneSurLeSite } from "@/components/videos/fiche/LigneSurLeSite";
import { exigerSession } from "@/services/auth";
import { listerEnLigne } from "@/services/site-videos";

export const metadata: Metadata = { title: "Sur le site" };
export const dynamic = "force-dynamic";

/** Ce qui est sur le site, par type de vidéo (lot S3). Les vues restent « — » tant que le site ne les remonte pas. */
export default async function PageSurLeSite() {
  await exigerSession();
  const groupes = await listerEnLigne();
  return (
    <div className="space-y-6">
      <EnTetePage titre="Sur le site" />
      {groupes.length === 0 ? (
        <EtatVide compact icone="lien" titre="Rien n'est encore sur le site" phrase="Cochez « Sur le site » dans une vidéo, relisez, puis publiez." />
      ) : (
        groupes.map((g) => (
          <Carte key={g.formatId}>
            <h2 className="font-titre text-lg text-texte">{g.nom}</h2>
            <ul className="mt-2 divide-y divide-trait">
              {g.videos.map((v) => (
                <LigneSurLeSite key={v.videoId} ligne={v} />
              ))}
            </ul>
          </Carte>
        ))
      )}
    </div>
  );
}
