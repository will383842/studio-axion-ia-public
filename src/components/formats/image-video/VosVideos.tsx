/**
 * ÉCRAN 5 · VOS VIDÉOS (lot L16, refait au lot I le 08/11, Williams). UN seul grand lecteur, une puce par réseau dessous
 * (`LecteurParReseau`), les actions du réseau choisi (Valider, Télécharger, Copier le texte). Le verdict de contrôle ne
 * s'affiche que s'il signale un souci (en remarque, jamais bloquant). Le texte d'origine et ce que le studio a adapté
 * sont repliés. Publication par téléchargement seulement : aucun bouton de programmation (le fichier enregistré est le
 * 9:16 commun). Facebook a deux fichiers (lot F45) : le Reel 9:16 et la vidéo du fil 4:5, deux puces ; LinkedIn est en 4:5
 * (décision de Will du 24/10, qui remplace celle du 19/10).
 */
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { BoutonLienPrive, type LienPriveVideo } from "@/components/partage/BoutonLienPrive";
import { Carte } from "@/components/ui/Carte";
import type { EtapeEditoriale } from "@/domaine/types";
import { LecteurParReseau, type VideoAffichee } from "./LecteurParReseau";

function Replie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-trait bg-surface-1 px-4 py-3">
      <summary className="cursor-pointer text-[15px] font-semibold text-texte">{titre}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export function VosVideos({
  videoId,
  videos,
  verdict,
  lienPrive,
  prete = true,
  etape,
  texteOrigine,
  adapte,
}: {
  videoId: string;
  videos: VideoAffichee[];
  verdict?: { ok: boolean; phrase: string; mentions: string[] };
  lienPrive?: LienPriveVideo;
  prete?: boolean;
  etape?: EtapeEditoriale;
  texteOrigine?: string;
  adapte?: readonly string[];
}) {
  return (
    <section aria-label="Vos vidéos" className="space-y-4">
      {(!verdict || verdict.ok) && <EnTeteSuivi etat="prete" />}
      <LecteurParReseau videoId={videoId} videos={videos} prete={prete} etape={etape} />
      {verdict && !verdict.ok && (
        <Carte className="border-brique">
          <p className="text-[15px] font-semibold text-brique">{verdict.phrase}</p>
          {verdict.mentions.length > 0 && (
            <ul className="mt-1 space-y-1 text-sm text-texte-doux">
              {verdict.mentions.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Carte>
      )}
      {lienPrive && <BoutonLienPrive {...lienPrive} />}
      {texteOrigine && (
        <Replie titre="Le texte d'origine">
          <p className="whitespace-pre-line text-sm text-texte-doux">{texteOrigine}</p>
        </Replie>
      )}
      {adapte && adapte.length > 0 && (
        <Replie titre="Ce que le studio a adapté">
          <ul className="list-disc space-y-1 pl-5 text-sm text-texte-doux">
            {adapte.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Replie>
      )}
    </section>
  );
}
