"use client";

/**
 * « MES ANIMATIONS » (Bibliothèque ; plan facecam v4, correctif du 09/10 ; lot D) : voir, renommer, retirer.
 * L'aperçu est une image fixe du code gardé, dans un cadre isolé SANS script ni réseau (`sandbox` vide) ; l'animation
 * complète se voit dans les vidéos (composition `CarteSurMesure` de la brique motion).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renommerAnimationAction, retirerAnimationAction } from "@/app/(studio)/videos/actions-facecam";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { notifier } from "@/components/ui/Toast";
import type { CodeCarte } from "@/moteurs/montage-facecam/monteur";
import type { AnimationGardee } from "@/services/monteur-facecam";

type Animation = AnimationGardee & { code: CodeCarte | null };

/** Document isolé de l'aperçu : HTML et CSS gardés, aucun script (la timeline n'est pas jouée ici). */
function documentApercu(code: CodeCarte): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#16120f;font-family:Poppins,system-ui,sans-serif}${code.css}</style></head><body>${code.html}</body></html>`;
}

export function MesAnimations({ animations }: { animations: Animation[] }) {
  const router = useRouter();
  const [envoi, demarrer] = useTransition();
  const [aRenommer, setARenommer] = useState<Animation | null>(null);
  const [nom, setNom] = useState("");

  if (!animations.length) {
    return <EtatVide icone="etincelles" titre="Aucune animation gardée" phrase="Sur « Votre vidéo », touchez « Garder ce modèle » sous une animation du monteur : elle sera réutilisable partout." />;
  }

  function lancer(f: () => Promise<{ ok: true } | { ok: false; message: string }>, succes: string, apres?: () => void) {
    demarrer(async () => {
      const r = await f();
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(succes);
      apres?.();
      router.refresh();
    });
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {animations.map((a) => (
          <li key={a.id} className="overflow-hidden rounded-carte border border-trait bg-surface-1">
            <div className="relative aspect-[9/16] overflow-hidden bg-fond">
              {a.code ? (
                <iframe title={`Aperçu : ${a.nom}`} sandbox="" srcDoc={documentApercu(a.code)} className="pointer-events-none absolute left-0 top-0 h-[1920px] w-[1080px] origin-top-left border-0" style={{ transform: "scale(var(--echelle))", ["--echelle" as string]: "0.16" }} loading="lazy" />
              ) : (
                <p className="grid h-full place-items-center px-3 text-center text-sm text-texte-faible">Aperçu indisponible</p>
              )}
            </div>
            <div className="p-3">
              <p className="truncate font-semibold text-texte">{a.nom}</p>
              <p className="line-clamp-2 text-sm text-texte-faible">{a.description}</p>
              <div className="mt-2 flex gap-1">
                <Bouton
                  variante="fantome"
                  disabled={envoi}
                  onClick={() => {
                    setARenommer(a);
                    setNom(a.nom);
                  }}
                >
                  Renommer
                </Bouton>
                <Bouton variante="fantome" disabled={envoi} onClick={() => lancer(() => retirerAnimationAction(a.id), "Animation retirée")}>
                  Retirer
                </Bouton>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <FeuilleBas
        ouverte={!!aRenommer}
        onOuverteChange={(v) => !v && setARenommer(null)}
        titre="Renommer l'animation"
        pied={
          <Bouton pleineLargeur chargement={envoi} disabled={!nom.trim()} onClick={() => aRenommer && lancer(() => renommerAnimationAction(aRenommer.id, nom), "Animation renommée", () => setARenommer(null))}>
            Enregistrer
          </Bouton>
        }
      >
        <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
      </FeuilleBas>
    </>
  );
}
