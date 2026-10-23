import { OngletsLiens } from "@/components/ui";

/** Onglets d'Écrire (B.6.1) : Scripts par défaut · Idées · Matières · Ma voix. */
export function OngletsEcrire() {
  return (
    <OngletsLiens
      libelle="Écrire"
      className="mb-2"
      onglets={[
        { href: "/maquettes-generateur/scripts", libelle: "Scripts", icone: "document", actif: true },
        { href: "/maquettes-generateur/scripts#idees", libelle: "Idées", icone: "idee", actif: false },
        { href: "/maquettes-generateur/scripts#matieres", libelle: "Matières", icone: "micro", actif: false },
        { href: "/maquettes-generateur/scripts#voix", libelle: "Ma voix", icone: "citation", actif: false },
      ]}
    />
  );
}
