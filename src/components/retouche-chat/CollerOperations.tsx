"use client";

/**
 * COLLER DES OPÉRATIONS (R1-09) — copie du plan lisible, zone où coller les opérations (JSON), aperçu dans le navigateur
 * (relecture stricte, impact), puis « Appliquer » : la route relit et refiltre tout (`filtrerOperations`). Éteint par défaut :
 * posé seulement si `ChatRetouche` reçoit `coller`. Aucun prix, aucun appel à Claude.
 */
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerOperations } from "@/services/retouche-chat/appliquer";
import { exporterPlanLisible } from "@/services/retouche-chat/export-plan";
import { impactRetouche } from "@/services/retouche-chat/impact";
import { lireOperations } from "@/services/retouche-chat/schema";
import type { EnvoiRetouche } from "./ChatRetouche";

const ILLISIBLE = "Je n'ai pas pu lire ces opérations : collez le bloc entier.";

export type ApercuCollage = { ok: true; operations: OperationRetouche[]; remarques: string[]; impact: { phrase: string; scenes: string[] } } | { ok: false; message: string };

/** Extrait le JSON du texte collé (bloc ``` ou texte autour), le relit strictement et mesure l'impact. Le filtre « modifier-script » est celui de la route, pas d'ici. */
export function apercuCollage(plan: PlanValide, texte: string): ApercuCollage {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  const debutTab = texte.indexOf("[");
  let brut: unknown;
  try {
    brut = JSON.parse(debut >= 0 && fin > debut ? texte.slice(debut, fin + 1) : texte.slice(debutTab, texte.lastIndexOf("]") + 1));
  } catch {
    return { ok: false, message: ILLISIBLE };
  }
  const liste = Array.isArray(brut) ? brut : brut && typeof brut === "object" ? (brut as { operations?: unknown }).operations : undefined;
  if (!Array.isArray(liste)) return { ok: false, message: ILLISIBLE };
  const { operations, remarques } = lireOperations(liste);
  const resultat = appliquerOperations(plan, operations);
  const impact = impactRetouche(plan, resultat.plan, resultat.operations);
  return { ok: true, operations, remarques: [...remarques, ...resultat.remarques.map((r) => r.message)], impact };
}

export function CollerOperations({ videoId, generateur, plan, envoyer }: { videoId: string; generateur?: string; plan: PlanValide; envoyer?: EnvoiRetouche }) {
  const [texte, setTexte] = useState("");
  const [apercu, setApercu] = useState<ApercuCollage | null>(null);
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(exporterPlanLisible(plan));
      setMessage("Plan copié.");
    } catch {
      setMessage("Copie impossible : sélectionnez le texte à la main.");
    }
  }

  async function appliquer() {
    if (!apercu?.ok || !envoyer || occupe) return;
    setOccupe(true);
    try {
      const r = await envoyer({ action: "appliquer", videoId, demande: "Opérations collées", operations: apercu.operations, ...(generateur ? { generateur } : {}) });
      const remarques = Array.isArray(r.remarques) ? (r.remarques as string[]) : [];
      setMessage(r.statut === "rendue" ? ["C'est fait : nouvelle version.", ...remarques].join(" ") : remarques.join(" ") || "Rien n'a changé.");
      setApercu(null);
    } catch {
      setMessage("La retouche n'est pas partie. Réessayez dans un instant.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section aria-label="Coller des opérations" className="flex flex-col gap-2">
      <Bouton variante="secondaire" onClick={() => void copier()}>
        Copier le plan
      </Bouton>
      <label className="text-sm" htmlFor={`coller-${videoId}`}>
        Collez ici les opérations
      </label>
      <textarea id={`coller-${videoId}`} value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} className="rounded-lg border border-trait bg-surface-1 px-3 py-2 text-sm" />
      <Bouton variante="secondaire" disabled={!texte.trim()} onClick={() => { setMessage(""); setApercu(apercuCollage(plan, texte)); }}>
        Voir l&apos;aperçu
      </Bouton>
      {apercu ? (
        <div className="flex flex-col gap-2 text-sm" aria-live="polite">
          {apercu.ok ? (
            <>
              <p>{[apercu.impact.phrase, ...apercu.remarques].join(" ")}</p>
              {apercu.operations.length > 0 && envoyer ? (
                <Bouton onClick={() => void appliquer()} chargement={occupe}>
                  Appliquer
                </Bouton>
              ) : null}
            </>
          ) : (
            <p>{apercu.message}</p>
          )}
        </div>
      ) : null}
      {message ? <p className="text-sm text-texte-doux">{message}</p> : null}
    </section>
  );
}
