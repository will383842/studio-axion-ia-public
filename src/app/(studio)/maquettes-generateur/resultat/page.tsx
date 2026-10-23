import type { Metadata } from "next";
import { EnTetePage, Pastille } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { EcranResultat } from "../_composants/EcranResultat";
import { RESULTAT_DEMO } from "../_demo";

export const metadata: Metadata = { title: "Résultat (maquette)" };

/** MAQUETTE GM (c) : l'écran Résultat. `?etat=valide` après validation ; `&feuille=1` ouvre la confirmation de fabrication. */
export default async function PageMaquetteResultat({ searchParams }: { searchParams: Promise<{ etat?: string; feuille?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const etape = sp.etat === "valide" ? "valide" : sp.etat === "a-valider" ? "a-valider" : "limite";
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={{ href: "/maquettes-generateur/scripts", libelle: "Scripts" }}
        surTitre={
          <span className="flex items-center gap-2">
            <Pastille ton="orange" icone="balance" taille="md">
              {RESULTAT_DEMO.format}
            </Pastille>
            <Pastille taille="md">{RESULTAT_DEMO.versions.length} versions</Pastille>
          </span>
        }
        titre={`n° ${RESULTAT_DEMO.numero}`}
        sousTitre={RESULTAT_DEMO.angle}
        className="mb-4"
      />
      <EcranResultat key={`${etape}-${sp.feuille}`} etapeInitiale={etape} feuilleOuverte={sp.feuille === "1"} />
    </div>
  );
}
