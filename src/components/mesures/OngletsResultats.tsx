import { OngletsLiens } from "@/components/ui/Onglets";

/**
 * Les deux parties de « Résultats » (maquette M5, décision de Williams du 12/11 : un seul nom, deux onglets).
 * Les deux adresses existantes sont gardées : /mesures (À saisir) et /mesures/ce-qui-marche (Ce qui marche).
 */
export function OngletsResultats({ actif, aSaisir }: { actif: "saisir" | "marche"; aSaisir?: number }) {
  return (
    <OngletsLiens
      libelle="Parties des résultats"
      className="mb-6"
      onglets={[
        { href: "/mesures", libelle: "À saisir", compteur: aSaisir || undefined, actif: actif === "saisir" },
        { href: "/mesures/ce-qui-marche", libelle: "Ce qui marche", actif: actif === "marche" },
      ]}
    />
  );
}
