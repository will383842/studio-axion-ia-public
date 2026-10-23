import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichePersonnage, type OngletFiche } from "@/components/personnages/FichePersonnage";
import { Icone } from "@/components/ui/Icone";
import { obtenirFichePersonnage } from "@/services/B-personnages-bibliotheque";
import { TEXTE_A_LIRE } from "@/services/personnages";
import { exigerSession } from "@/services/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await exigerSession();
  const { id } = await params;
  const fiche = await obtenirFichePersonnage(id);
  return { title: fiche?.personnage.nom ?? "Personnage" };
}

/** FICHE PERSONNAGE (B.8 #14) : Visages · Voix · Accord. Niveau 1. Propriétaire : développeur B. */
export default async function PagePersonnage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  await exigerSession();
  const [{ id }, { onglet }] = await Promise.all([params, searchParams]);
  const fiche = await obtenirFichePersonnage(id);
  if (!fiche) notFound();
  const ongletInitial: OngletFiche = onglet === "voix" || onglet === "accord" ? onglet : "visages";
  const prenom = fiche.personnage.nom.split(/\s+/)[0];
  const texte = fiche.personnage.nature === "moi" ? TEXTE_A_LIRE : TEXTE_A_LIRE.replace("Williams", prenom);
  return (
    <div>
      <Link href="/personnages" className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-texte-doux hover:text-texte">
        <Icone nom="fleche-gauche" size={16} />
        Personnages
      </Link>
      <FichePersonnage key={fiche.personnage.id} fiche={fiche} texteALire={texte} ongletInitial={ongletInitial} />
    </div>
  );
}
