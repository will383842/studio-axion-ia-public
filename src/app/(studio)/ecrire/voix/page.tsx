import { redirect } from "next/navigation";

/**
 * MA VOIX (refonte R7) : une seule page pour Ma voix, l'onglet « Ma voix » d'Écrire. Cette adresse y renvoie
 * et garde `?rubrique=<id>` (rubrique ouverte).
 */
export default async function PageMaVoix({ searchParams }: { searchParams: Promise<{ rubrique?: string }> }) {
  const { rubrique } = await searchParams;
  const p = new URLSearchParams({ onglet: "voix" });
  if (rubrique) p.set("rubrique", rubrique);
  redirect(`/ecrire?${p.toString()}`);
}
