import type { Metadata } from "next";
import { SaisieMesures } from "@/components/generateur/SaisieMesures";
import { OngletsResultats } from "@/components/mesures/OngletsResultats";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { listerMesuresASaisir, listerMesuresSaisies } from "@/services/mesures";

export const metadata: Metadata = { title: "Résultats" };
export const dynamic = "force-dynamic";

/**
 * RÉSULTATS › À SAISIR (plan v5 B.8 §2, lot G7a ; refonte R8a, maquette M5) : les vidéos publiées depuis 3 ou 7 jours ;
 * 30 s par vidéo, au téléphone. Un seul nom, « Résultats », avec deux onglets (la seconde partie : « Ce qui marche »).
 * Aucune prédiction : les chiffres saisis sont rangés tels quels ; les rangs sont dans « Ce qui marche » (G7b).
 */
export default async function PageMesures() {
  await exigerSession();
  const [aSaisir, saisies] = await Promise.all([listerMesuresASaisir(), listerMesuresSaisies()]);
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage titre="Résultats" sousTitre="Notez les chiffres de vos vidéos publiées, puis regardez ce qui marche le mieux." className="mb-4" />
      <OngletsResultats actif="saisir" aSaisir={aSaisir.length} />
      <SaisieMesures
        aSaisir={aSaisir.map((m) => ({ publicationId: m.publicationId, code: m.code, reseau: m.reseau, titre: m.titre, jour: m.jour, datePublication: m.datePublication }))}
        saisies={saisies.map((s) => ({ cle: `${s.publicationId}-${s.jour}-${s.le}`, code: s.code, reseau: s.reseau, jour: s.jour, tauxAbandon3s: s.tauxAbandon3s, dureeMoyenneVueSec: s.dureeMoyenneVueSec, partagesParPortee: s.partagesParPortee }))}
      />
    </ConteneurPage>
  );
}
