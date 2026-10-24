/**
 * ÉCRAN 5 · VOS VIDÉOS (lot L16, plan § 8). Une carte par réseau : la vidéo, le verdict en une phrase (vert, orange
 * « un peu longue » ou « version courte », rouge si le réseau n'est pas livré), le texte de publication et le premier
 * commentaire à copier, l'endroit où poser le lien, le téléchargement. Publication par téléchargement seulement :
 * aucun bouton de programmation (deux défauts Buffer sont encore ouverts). Facebook a deux fichiers (lot F45) : le Reel
 * en 9:16 et la vidéo du fil en 4:5, chacun avec son lecteur et son téléchargement ; LinkedIn est en 4:5 (décision de Will du 24/10, qui remplace celle du 19/10).
 */
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { BoutonLienPrive, type LienPriveVideo } from "@/components/partage/BoutonLienPrive";
import { Bouton } from "@/components/ui/Bouton";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { Carte } from "@/components/ui/Carte";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import type { CarteReseauIV } from "./vue";

const TON = { vert: "sauge", orange: "ambre", rouge: "brique" } as const;

type VideoAffichee = CarteReseauIV & { url?: string | null; urlFil?: string | null };

function CarteVideo({ v }: { v: VideoAffichee }) {
  return (
    <Carte as="li" className="list-none space-y-3">
      <div className="flex items-center gap-3">
        <LogoReseau reseau={v.reseau} taille="md" />
        <span className="text-[17px] font-semibold text-texte">{v.nom}</span>
        {v.duree && <span className="text-sm text-texte-doux">{v.duree}</span>}
      </div>
      <Pastille ton={TON[v.ton]} taille="md" className="whitespace-normal">
        {v.phrase}
      </Pastille>
      {v.url && <LecteurVideo src={v.url} ratio={v.format ?? "9:16"} titre={v.fil ? `${v.nom} · Reel` : v.nom} />}
      {v.titre && <p className="text-[15px] font-semibold text-texte">{v.titre}</p>}
      {v.texte && <p className="line-clamp-4 whitespace-pre-line text-sm text-texte-doux">{v.texte}</p>}
      <div className="flex flex-wrap gap-2">
        {v.url && (
          <Bouton asChild variante="secondaire" icone="telecharger">
            <a href={v.url} download>
              Télécharger
            </a>
          </Bouton>
        )}
        {v.texte && <BoutonCopier texte={v.texte} libelle="Copier le texte" />}
        {v.premierCommentaire && <BoutonCopier texte={v.premierCommentaire} libelle="Copier le commentaire" />}
        {v.lien && <BoutonCopier texte={v.lien} libelle="Copier le lien" />}
      </div>
      {v.consigneLien && <p className="text-sm text-texte-doux">Le lien : {v.consigneLien}</p>}
      {v.fil && (
        <div className="space-y-3 border-t border-trait pt-3">
          <p className="text-[15px] font-semibold text-texte">
            Fil d&apos;actualité{v.fil.duree && <span className="ml-2 text-sm font-normal text-texte-doux">{v.fil.duree}</span>}
          </p>
          {v.urlFil && <LecteurVideo src={v.urlFil} ratio="4:5" titre={`${v.nom} · fil`} />}
          <div className="flex flex-wrap gap-2">
            {v.urlFil && (
              <Bouton asChild variante="secondaire" icone="telecharger">
                <a href={v.urlFil} download>
                  Télécharger le fil
                </a>
              </Bouton>
            )}
            {v.fil.texte && <BoutonCopier texte={v.fil.texte} libelle="Copier le texte du fil" />}
          </div>
          {v.fil.consigneLien && <p className="text-sm text-texte-doux">Le lien : {v.fil.consigneLien}</p>}
        </div>
      )}
    </Carte>
  );
}

export function VosVideos({ videos, verdict, lienPrive }: { videos: VideoAffichee[]; verdict?: { ok: boolean; phrase: string; mentions: string[] }; lienPrive?: LienPriveVideo }) {
  return (
    <section aria-label="Vos vidéos" className="space-y-4">
      {(!verdict || verdict.ok) && <EnTeteSuivi etat="prete" />}
      {lienPrive && <BoutonLienPrive {...lienPrive} />}
      {verdict && (
        <Carte lueur={verdict.ok} className={verdict.ok ? undefined : "border-brique"}>
          <p className={verdict.ok ? "text-[15px] font-semibold text-sauge" : "text-[15px] font-semibold text-brique"}>{verdict.phrase}</p>
          {verdict.mentions.length > 0 && (
            <ul className="mt-1 space-y-1 text-sm text-texte-doux">
              {verdict.mentions.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Carte>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {videos.map((v) => (
          <CarteVideo key={v.reseau} v={v} />
        ))}
      </ul>
    </section>
  );
}
