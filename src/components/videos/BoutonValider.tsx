"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { changerEtapeEditorialeAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { ETAPES_EDITORIALES } from "@/domaine/libelles";
import type { EtapeEditoriale } from "@/domaine/types";

/**
 * « Valider » une vidéo prête (lot S) : jamais bloqué, une seule action.
 *  - prête, à relire (ou sans étape) : bouton « Valider » ;
 *  - validée : pastille « Validée » et « Remettre à relire » ;
 *  - programmée ou publiée : la pastille seule ;
 *  - pas prête : rien.
 * Le bouton n'est grisé que pendant l'envoi.
 */
export function BoutonValider({ videoId, prete, etape, variante = "principal", sansPastilleEtape = false }: { videoId: string; prete: boolean; etape?: EtapeEditoriale; /** « secondaire » quand la barre du bas porte déjà le seul bouton orange. */ variante?: "principal" | "secondaire"; /** L'en-tête de la fiche montre déjà le statut (9 statuts de l'usine) : pas de pastille en double. */ sansPastilleEtape?: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  if (!prete) return null;

  function changer(vers: EtapeEditoriale, succes: string) {
    demarrer(async () => {
      let r: Awaited<ReturnType<typeof changerEtapeEditorialeAction>>;
      try {
        r = await changerEtapeEditorialeAction(videoId, vers);
      } catch {
        notifier.erreur("Le serveur ne répond pas. Réessayez dans un instant.");
        return;
      }
      if (!r.ok) {
        notifier.erreur(r.message ?? "Un souci est survenu.");
        return;
      }
      notifier.succes(succes);
      router.refresh();
    });
  }

  if (etape === "programmee" || etape === "publiee") return sansPastilleEtape ? null : <PastilleEtape etape={etape} />;
  if (etape === "validee") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {!sansPastilleEtape && <PastilleEtape etape="validee" />}
        <Bouton variante="fantome" taille="md" disabled={enCours} onClick={() => changer("a_relire", "Remise à relire")}>
          Remettre à relire
        </Bouton>
      </span>
    );
  }
  return (
    <Bouton variante={variante} taille="md" icone="coche" disabled={enCours} onClick={() => changer("validee", "Vidéo validée")}>
      Valider
    </Bouton>
  );
}

function PastilleEtape({ etape }: { etape: EtapeEditoriale }) {
  const e = ETAPES_EDITORIALES[etape];
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-sauge-doux px-3 text-sm font-semibold text-sauge">
      <Icone nom={e.icone} size={16} />
      {e.libelle}
    </span>
  );
}
