"use server";

/** Actions serveur de la page « Veille » (lot B2). Chacune commence par exigerSession(). Rien n'est supprimé. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { ajouterOutil, essayerNouveaute, ignorerNouveaute, rangerOutil, reprendreNouveaute, verifierMaintenant } from "@/services/veille";

function rafraichir() {
  revalidatePath("/veille");
  revalidatePath("/reglages");
}

export async function essayerNouveauteAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await essayerNouveaute(id);
    rafraichir();
    return undefined;
  });
}

export async function ignorerNouveauteAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ignorerNouveaute(id);
    rafraichir();
    return undefined;
  });
}

export async function reprendreNouveauteAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await reprendreNouveaute(id);
    rafraichir();
    return undefined;
  });
}

export async function ajouterOutilAction(nom: string, adresse: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ajouterOutil(nom, adresse);
    rafraichir();
    return undefined;
  });
}

export async function rangerOutilAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rangerOutil(id);
    rafraichir();
    return undefined;
  });
}

export async function verifierMaintenantAction(): Promise<Resultat<{ nouveautes: number; muets: number; saute: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await verifierMaintenant();
    rafraichir();
    return { nouveautes: r.nouveautes.length, muets: r.muets.length, saute: !!r.saute };
  });
}
