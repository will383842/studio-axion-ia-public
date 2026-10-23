"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Bouton, FeuilleBas, notifier, Pastille } from "@/components/ui";
import { formaterMontant } from "@/lib/montants";
import type { EstimationLook, VueDecor } from "@/services/decors";
import { estimerLookAction, mettreEnAvantAction, preparerLookAction, rangerDecorAction, validerDecorAction } from "./actions";
import { RelierLookHeygen } from "./RelierLookHeygen";
import { VignetteDecor } from "./VignetteDecor";

const ANGLES: Record<string, string> = { face: "face", "trois-quarts": "trois quarts", profil: "profil" };

/**
 * Détail d'un décor (lot B1) : grande vignette sur le double, état, et UNE action principale selon l'état :
 * fabriquer le décor avec votre double (coût affiché d'abord), le valider sur capture, ou le mettre en avant.
 */
export function FeuilleDecor({ decor, silhouette, onFermer }: { decor: VueDecor | null; silhouette: string; onFermer: () => void }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  // Estimation gardée avec l'identifiant du décor : un autre décor ouvert ne montre jamais un coût périmé.
  const [estimation, setEstimation] = useState<{ id: string; look: EstimationLook } | null>(null);
  const look = decor && estimation?.id === decor.id ? estimation.look : null;

  useEffect(() => {
    if (!decor || decor.etat !== "look-a-creer") return;
    let actif = true;
    void estimerLookAction(decor.id).then((r) => {
      if (actif && r.ok) setEstimation({ id: decor.id, look: r.donnees });
    });
    return () => {
      actif = false;
    };
  }, [decor]);

  function agir(f: () => Promise<{ ok: boolean; message?: string }>, succes: string) {
    demarrer(async () => {
      const r = await f();
      if (!r.ok) return void notifier.erreur(r.message ?? "Échec.");
      notifier.succes(succes);
      onFermer();
      router.refresh();
    });
  }

  const d = decor;
  return (
    <FeuilleBas ouverte={!!d} onOuverteChange={(v) => !v && onFermer()} titre={d?.nom ?? "Décor"} description={d?.description}>
      {d && (
        <div className="space-y-4">
          <div className="mx-auto w-44">
            <VignetteDecor surDouble={d.surDouble} image={d.image} silhouette={d.surDouble ? undefined : silhouette} alt={d.nom} />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Pastille ton={d.ton}>{d.libelleEtat}</Pastille>
            {d.misEnAvant && <Pastille ton="orange">Récurrent</Pastille>}
            {d.defautAvocat && <Pastille>Défaut avocat</Pastille>}
            {d.clair && <Pastille>Clair</Pastille>}
          </div>

          {d.etat === "look-a-creer" && (
            <div className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-texte-doux">
              {look?.bloque ? (
                look.bloque
              ) : look ? (
                <>
                  Fabriqué avec votre double, dans la pièce ({look.angles.map((a) => ANGLES[a]).join(" et ")}). Puis réutilisé gratuitement.
                  <span className="mt-1 block font-semibold text-texte">
                    {formaterMontant(look.cout)}
                    {look.essai ? " · essai" : ""}
                  </span>
                </>
              ) : (
                "Calcul du coût…"
              )}
            </div>
          )}

          {/* Correcteur réel 2 : un look fait dans l'application HeyGen se relie ici (lecture gratuite). */}
          {d.methode === "look-heygen" && !d.range && (
            <RelierLookHeygen
              decorId={d.id}
              looksRelies={d.looksRelies}
              onRelie={() => {
                onFermer();
                router.refresh();
              }}
            />
          )}

          <div className="space-y-2">
            {d.etat === "look-a-creer" && look && !look.bloque && (
              <Bouton pleineLargeur taille="lg" icone="etincelles" essai={look.essai} chargement={enCours} onClick={() => agir(() => preparerLookAction(d.id, true), "Décor en fabrication : à vérifier sur capture")}>
                Fabriquer · {formaterMontant(look.cout)}
              </Bouton>
            )}
            {d.etat === "look-a-verifier" && (
              <Bouton pleineLargeur taille="lg" icone="valide" chargement={enCours} onClick={() => agir(() => validerDecorAction(d.id), "Décor validé")}>
                Valider sur capture
              </Bouton>
            )}
            {!d.range && (d.etat === "fond-neutre" || d.etat === "photo" || d.etat === "look-pret") && (
              <Bouton
                pleineLargeur
                variante={d.misEnAvant ? "secondaire" : "principal"}
                icone="etoile"
                chargement={enCours}
                onClick={() => agir(() => mettreEnAvantAction(d.id, !d.misEnAvant), d.misEnAvant ? "Retiré des récurrents" : "Mis en avant")}
              >
                {d.misEnAvant ? "Retirer des récurrents" : "Mettre en avant"}
              </Bouton>
            )}
            {!d.defautAvocat && (
              <Bouton pleineLargeur variante="fantome" icone="archive" chargement={enCours} onClick={() => agir(() => rangerDecorAction(d.id, !d.range), d.range ? "Remis" : "Rangé (rien n'est supprimé)")}>
                {d.range ? "Remettre" : "Ranger"}
              </Bouton>
            )}
          </div>
        </div>
      )}
    </FeuilleBas>
  );
}
