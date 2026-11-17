import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { ConteneurPage } from "@/components/ui/ConteneurPage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { obtenirReseau } from "@/reseaux";
import { fournisseurParId } from "@/fournisseurs";
import { depots } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { construireFileACorriger, LIBELLE_A_CORRIGER, LIBELLE_MES_TEXTES } from "@/services/calendrier-reprogrammation";
import { reessayerEnvoi } from "@/services/reprise-envois";

export const metadata: Metadata = { title: LIBELLE_A_CORRIGER };
export const dynamic = "force-dynamic";

const heureParis = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

function quand(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : heureParis.format(d);
}

/**
 * Un geste, une seule fois : un nouvel essai (refus net) ou une relecture (à vérifier). Passe par `reessayerEnvoi`, donc par le
 * réglage d'envoi du calendrier (éteint par défaut) et toutes les gardes de l'envoi normal. Aucune modification chez le diffuseur.
 */
async function agir(formulaire: FormData): Promise<void> {
  "use server";
  await exigerSession();
  const id = formulaire.get("id");
  if (typeof id !== "string" || !id) return;
  try {
    await reessayerEnvoi(id, { service: fournisseurParId("publication", "zernio") });
  } catch {
    // Le refus (réglage fermé, créneau changé, essai déjà fait) laisse la ligne telle quelle : rien n'est parti.
  }
  revalidatePath("/calendrier/a-reprogrammer");
}

const BOUTON: Record<"reessayer" | "relire", string> = { reessayer: "Réessayer une fois", relire: "Relire chez le diffuseur" };

/** File « À corriger » : les envois qui n'ont pas abouti. Aucun envoi automatique ; le réglage d'envoi du calendrier reste maître. */
export default async function PageACorriger() {
  await exigerSession();
  const lignes = construireFileACorriger(await depots().publications.lister());
  return (
    <ConteneurPage largeur="lecture">
      <EnTetePage retour={{ href: "/calendrier", libelle: "Calendrier" }} titre={LIBELLE_A_CORRIGER} sousTitre={lignes.length ? `${lignes.length} envoi${lignes.length > 1 ? "s" : ""}` : undefined} />
      <p className="mt-2 text-sm text-texte-doux">
        Rien ne repart tout seul. Un envoi refusé peut être réessayé une seule fois ; un envoi à vérifier est seulement relu. Vos textes restent dans <a className="underline" href="/ecrire">{LIBELLE_MES_TEXTES}</a>.
      </p>
      {lignes.length === 0 ? (
        <EtatVide icone="calendrier" titre="Rien à corriger" phrase="Les envois qui n'ont pas abouti apparaîtront ici." />
      ) : (
        <ul className="mt-4 divide-y divide-trait rounded-xl border border-trait bg-surface-1">
          {lignes.map((l) => (
            <li key={l.publicationId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-texte">
                  {obtenirReseau(l.reseau).nom} · {quand(l.date)}
                </p>
                <p className="text-texte-doux">{l.phrase}</p>
              </div>
              {l.action !== "a-la-main" && (
                <form action={agir}>
                  <input type="hidden" name="id" value={l.publicationId} />
                  <button type="submit" className="min-h-11 rounded-xl border border-trait px-4 font-medium">
                    {BOUTON[l.action]}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </ConteneurPage>
  );
}
