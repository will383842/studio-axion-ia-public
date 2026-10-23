import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { EcranSujet } from "../_composants/EcranSujet";

export const metadata: Metadata = { title: "Nouveau sujet (maquette)" };

/** MAQUETTE GM (b) : l'écran Sujet. `?sensible=1` montre le cas d'un sujet juridique ; `?vide=1` l'écran vierge. */
export default async function PageMaquetteSujet({ searchParams }: { searchParams: Promise<{ sensible?: string; vide?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const sensible = sp.sensible === "1";
  const idee = sp.vide === "1" ? "" : sensible ? "Faut-il un DPO dans une PME de 20 personnes ?" : "Est-ce que ChatGPT peut lire nos factures ?";
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/maquettes-generateur/scripts", libelle: "Scripts" }} titre="Nouveau sujet" className="mb-4" />
      <EcranSujet key={`${sensible}-${idee}`} ideeInitiale={idee} sensible={sensible} />
    </div>
  );
}
