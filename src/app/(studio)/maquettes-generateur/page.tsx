import type { Metadata } from "next";
import Link from "next/link";
import { Carte, EnTetePage, Icone, type NomIcone } from "@/components/ui";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Maquettes du générateur" };

const ECRANS: { href: string; titre: string; icone: NomIcone }[] = [
  { href: "/maquettes-generateur/scripts", titre: "Scripts", icone: "grille" },
  { href: "/maquettes-generateur/sujet", titre: "Nouveau sujet", icone: "idee" },
  { href: "/maquettes-generateur/resultat", titre: "Résultat", icone: "document" },
  { href: "/maquettes-generateur/il-manque", titre: "Il manque une matière", icone: "micro" },
  { href: "/maquettes-generateur/resultat?etat=valide&feuille=1", titre: "Fabriquer", icone: "film" },
];

/** Sommaire des maquettes du lot GM (données de démonstration, rien n'est envoyé). */
export default async function PageMaquettes() {
  await exigerSession();
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage titre="Maquettes" sousTitre="Générateur de scripts, à valider sur téléphone." />
      <ul className="grid grid-cols-2 gap-3">
        {ECRANS.map((e) => (
          <li key={e.href}>
            <Link href={e.href} className="block h-full">
              <Carte interactive className="flex h-full flex-col gap-3">
                <Icone nom={e.icone} size={22} className="text-orange-vif" />
                <span className="font-semibold text-texte">{e.titre}</span>
              </Carte>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
