import type { Metadata } from "next";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { JoursProposes } from "@/components/calendrier/JoursProposes";
import { ContenusARelancer, LIBELLES_A_RELANCER } from "@/components/calendrier/ContenusARelancer";
import type { IdReseau } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { listerContenusARelancer } from "@/services/contenus-a-relancer";
import { depsAutoParDefaut, proposerSiAllume } from "@/services/republication-auto";
import { comptesCibles } from "../charger-comptes";
import { creerNouvelleVersionAction } from "./actions";

export const metadata: Metadata = { title: LIBELLES_A_RELANCER.titre };
export const dynamic = "force-dynamic";

/** Contenus à relancer : la liste proposée, et un formulaire par ligne. Rien n'est envoyé ni programmé d'ici. */
export default async function PageARelancer({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await exigerSession();
  const { message } = await searchParams;
  const lignes = await listerContenusARelancer();
  const reseaux = [...new Set(lignes.map((l) => l.reseau))] as IdReseau[];
  const comptes = lignes.length ? await comptesCibles(reseaux) : {};
  // Éteint par défaut : rien n'est calculé. Allumé : des jours proposés, sans aucune écriture.
  const propositions = lignes.length ? await proposerSiAllume(depsAutoParDefaut(lignes), new Date()) : [];
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage retour={{ href: "/calendrier", libelle: "Calendrier" }} titre={LIBELLES_A_RELANCER.titre} />
      <p className="mt-2 text-sm text-texte-doux">{LIBELLES_A_RELANCER.aide}</p>
      {message && (
        <p role="status" className="mt-3 rounded-xl border border-trait px-4 py-3 text-sm">
          {message.slice(0, 300)}
        </p>
      )}
      <JoursProposes suggestions={propositions} comptes={comptes} action={creerNouvelleVersionAction} />
      {lignes.length === 0 ? (
        <EtatVide icone="calendrier" titre={LIBELLES_A_RELANCER.videTitre} phrase={LIBELLES_A_RELANCER.videPhrase} />
      ) : (
        <ContenusARelancer lignes={lignes} comptes={comptes} action={creerNouvelleVersionAction} />
      )}
    </ConteneurPage>
  );
}
