"use server";

import { redirect } from "next/navigation";
import { seConnecter } from "@/services/auth";

export interface EtatConnexion {
  message?: string;
  bloqueJusqua?: string;
}

/** Action du formulaire de connexion. Seule action exemptée d'exigerSession() (elle crée la session). */
export async function connexionAction(_etat: EtatConnexion, donnees: FormData): Promise<EtatConnexion> {
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const resterConnecte = donnees.get("resterConnecte") === "on";
  const suite = String(donnees.get("suite") ?? "/");
  const r = await seConnecter(motDePasse, resterConnecte);
  if (!r.ok) return { message: r.message, bloqueJusqua: r.bloqueJusqua };
  // N'accepter qu'un chemin interne (pas de redirection ouverte).
  redirect(suite.startsWith("/") && !suite.startsWith("//") ? suite : "/");
}
