import type { Metadata } from "next";
import Link from "next/link";
import { SaisieMesures } from "@/components/generateur/SaisieMesures";
import { Bouton } from "@/components/ui/Bouton";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { listerMesuresASaisir, listerMesuresSaisies } from "@/services/mesures";

export const metadata: Metadata = { title: "Mesures" };
export const dynamic = "force-dynamic";

/**
 * MESURES À SAISIR (plan v5 B.8 §2, lot G7a) : les vidéos publiées depuis 3 ou 7 jours ; 30 s par vidéo, au téléphone.
 * Aucune prédiction : les chiffres saisis sont rangés tels quels ; les rangs sont dans « Ce qui marche » (G7b).
 */
export default async function PageMesures() {
  await exigerSession();
  const [aSaisir, saisies] = await Promise.all([listerMesuresASaisir(), listerMesuresSaisies()]);
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={{ href: "/", libelle: "Accueil" }}
        titre="Mesures"
        sousTitre={aSaisir.length ? `${aSaisir.length} à saisir` : undefined}
        actions={
          <Bouton asChild variante="secondaire" icone="tendance">
            <Link href="/mesures/ce-qui-marche">Ce qui marche</Link>
          </Bouton>
        }
        className="mb-4"
      />
      <SaisieMesures
        aSaisir={aSaisir.map((m) => ({ publicationId: m.publicationId, code: m.code, reseau: m.reseau, titre: m.titre, jour: m.jour, datePublication: m.datePublication }))}
        saisies={saisies.map((s) => ({ cle: `${s.publicationId}-${s.jour}-${s.le}`, code: s.code, reseau: s.reseau, jour: s.jour, tauxAbandon3s: s.tauxAbandon3s, dureeMoyenneVueSec: s.dureeMoyenneVueSec, partagesParPortee: s.partagesParPortee }))}
      />
    </div>
  );
}
