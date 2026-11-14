import "server-only";
import type { IdReseau } from "@/domaine/types";
import { compteCibleValide } from "./compte-cible";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import { canauxZernioEnregistres } from "@/services/comptes-envoi-zernio";

const COMPTE_PAR_DEFAUT = "compte-studio";

/**
 * Compte cible de chaque réseau pour un ajout manuel. Lecture seule : les comptes gardés au dernier « Tester » (aucun appel fournisseur).
 * Exactement UN compte relié et non déconnecté pour le réseau : son identifiant. Zéro ou plusieurs : « compte-studio ».
 * Ne lève jamais : en cas de panne, chaque réseau garde la valeur par défaut.
 */
export async function comptesCibles(reseaux: IdReseau[]): Promise<Partial<Record<IdReseau, string>>> {
  const defaut = (): Partial<Record<IdReseau, string>> => Object.fromEntries(reseaux.map((r) => [r, COMPTE_PAR_DEFAUT])) as Partial<Record<IdReseau, string>>;
  try {
    const canaux = (await canauxZernioEnregistres())?.canaux ?? [];
    const resultat = defaut();
    for (const r of reseaux) {
      try {
        const plateforme = plateformeZernio(r);
        const dispo = canaux.filter((c) => c.service === plateforme && !c.deconnecte && !(c.service === "facebook" && pageInterdite(c.id.includes(":fb:") ? c.id.split(":fb:")[1] : undefined, c.nom)));
        if (dispo.length === 1 && compteCibleValide(dispo[0].id)) resultat[r] = dispo[0].id;
      } catch {
        // Réseau que Zernio ne porte pas : valeur par défaut.
      }
    }
    return resultat;
  } catch {
    return defaut();
  }
}
