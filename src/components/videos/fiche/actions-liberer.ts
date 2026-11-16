"use server";

/**
 * Actions serveur de « Libérer la place » (G13-13). Chacune commence par exigerSession(), puis relit l'interrupteur
 * `retoucheSegments.liberer` (éteint par défaut : seul `true` exact allume). Rien n'est effacé sans confirmation.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { depots, essayer, fournisseur, journaliser, lireParametre, type Resultat } from "@/services/_commun";
import { libererPlace, scenesALiberer, type PortsLiberer, type ResultatLiberer } from "@/services/retouche-segments/liberer";

async function actif(): Promise<boolean> {
  return (await lireParametre<unknown>("retoucheSegments.liberer", false).catch(() => false)) === true;
}

async function ports(videoId: string): Promise<PortsLiberer> {
  const stockage = await fournisseur("stockage");
  const d = depots();
  const versions = await d.versions.lister((x) => x.videoId === videoId);
  const ids = new Set(versions.map((x) => x.id));
  return {
    env: process.env.NODE_ENV === "production" ? "prod" : "dev",
    lireVersions: async () => versions.map((v) => ({ id: v.id, projetMontage: (v as { projetMontage?: unknown }).projetMontage })),
    lireTravaux: async () => (await d.travaux.lister((t) => t.cibleId === videoId || (!!t.versionId && ids.has(t.versionId)))).map((t) => ({ statut: t.statut, parametres: t.parametres })),
    listerPrefixe: async (p) => (await stockage.listerPrefixe?.(p)) ?? [],
    tailleObjet: async (c) => (await stockage.tailleObjet?.(c)) ?? null,
    supprimer: async (c) => {
      if (!stockage.supprimer) throw new Error("Le stockage ne sait pas effacer");
      await stockage.supprimer(c);
    },
    journaliser: (m) => void journaliser("liberer_place", m, { type: "video", id: videoId }).catch(() => undefined),
  };
}

export type ApercuLiberer = { fichiers: number; octets: number };

/** Combien de fichiers seraient effacés (rien n'est effacé ici). */
export async function apercuLibererAction(videoId: string): Promise<Resultat<ApercuLiberer>> {
  await exigerSession();
  return essayer(async () => {
    if (!(await actif())) throw new Error("Fonction éteinte");
    const r = await scenesALiberer(videoId, await ports(videoId));
    if (r.refus !== null) throw new Error(r.refus);
    return { fichiers: r.cles.length, octets: r.octets };
  });
}

/** Efface, après la confirmation de Will (`confirme === true`), la liste recalculée à l'instant. */
export async function libererPlaceAction(videoId: string, confirme: boolean): Promise<Resultat<ResultatLiberer>> {
  await exigerSession();
  return essayer(async () => {
    if (confirme !== true) throw new Error("Confirmation absente");
    if (!(await actif())) throw new Error("Fonction éteinte");
    const r = await libererPlace(videoId, await ports(videoId), true);
    if (r.refus !== null) throw new Error(r.refus);
    revalidatePath(`/videos/${videoId}`);
    return r;
  });
}
