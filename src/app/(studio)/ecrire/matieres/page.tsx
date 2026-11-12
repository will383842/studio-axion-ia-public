import { redirect } from "next/navigation";

/**
 * MATIÈRES (refonte R7) : une seule page pour Matières, l'onglet « Matières » d'Écrire. Cette adresse y renvoie
 * et garde ses paramètres : `?type=<type>|preuves` filtre ; `?ajout=matiere|vrac|preuve` ouvre la saisie.
 */
export default async function PageMatieres({ searchParams }: { searchParams: Promise<{ type?: string; ajout?: string }> }) {
  const { type, ajout } = await searchParams;
  const p = new URLSearchParams({ onglet: "matieres" });
  if (type) p.set("type", type);
  if (ajout) p.set("ajout", ajout);
  redirect(`/ecrire?${p.toString()}`);
}
