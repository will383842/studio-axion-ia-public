/**
 * C2-U12 : tirage, au lancement, du style de texte à l'écran varié (capacité `texte.style-varie`).
 * Pur, ne lève jamais, ne lit aucun réglage. Côté Studio seulement : jamais importé par `studio-rendu/**`, `scene.ts`,
 * `style.ts` ni les fichiers lus par le rendu. Éteint par défaut : tous les profils ont `permis: false`, et aucun style
 * ne porte `texteEcran.varier: true` ; dans ces cas la commande est rendue telle quelle (même référence).
 */
import { ID } from "@/briques/bibliotheque-video/catalogue";
import { bibliothequeDeLaCommande, porteCapacite } from "@/briques/bibliotheque-video/moteur";
import { CLE_ENTREE_BIBLIOTHEQUE, lireEntreeBibliotheque } from "@/briques/bibliotheque-video/schema";
import type { BlocTexteEcran, Candidat } from "@/briques/bibliotheque-video/types";
import type { CommandeFabrication } from "@/domaine/types";

type Pave = "forts-et-chiffres" | null;

/** Produit teintes × cibles × pavé, chaque candidat porte une signature lisible, stable et triée. */
export function candidatsTexteEcran(bloc: BlocTexteEcran): Candidat[] {
  const paves: Pave[] = bloc.pave ? [null, "forts-et-chiffres"] : [null];
  const sortie: Candidat[] = [];
  for (const teinte of [...bloc.teintes].sort())
    for (const cible of [...bloc.cibles].sort())
      for (const pave of paves) {
        const cle = `${teinte}|${cible}|${pave ?? "-"}`;
        sortie.push({ id: cle, capacite: ID.texteStyleVarie, cle });
      }
  return sortie;
}

export function appliquerTexteEcranAuLancement(commande: CommandeFabrication): CommandeFabrication {
  try {
    const style = commande.styles?.sousTitres;
    const reglages = style?.valeur?.texteEcran;
    if (!style || !style.valeur || !reglages || reglages.varier !== true) return commande;
    const entree = lireEntreeBibliotheque(commande.entrees);
    if (!entree) return commande;
    const porte = porteCapacite(commande.entrees, ID.texteStyleVarie);
    if (!porte.bibliotheque || !porte.permis) return commande;
    const bloc = entree.profil.blocs?.texteEcran;
    const lecteur = bibliothequeDeLaCommande(commande);
    if (!bloc || !lecteur) return commande;

    // Jamais une des N dernières signatures de la capacité, sauf si cela vide la liste.
    const evites = new Set(
      entree.recents.filter((r) => r.capacite === ID.texteStyleVarie).slice(0, Math.max(0, bloc.signaturesAEviter)).map((r) => r.cle),
    );
    const tous = candidatsTexteEcran(bloc);
    const gardes = tous.filter((c) => !evites.has(c.cle));
    const r = lecteur.choisir({ capacite: ID.texteStyleVarie }, gardes.length > 0 ? gardes : tous);
    if (!r.ok || r.choisis.length === 0) return commande;

    const cle = r.choisis[0].cle;
    const [teinte, cible, pave] = cle.split("|");
    const nouvelle: CommandeFabrication = {
      ...commande,
      styles: {
        ...commande.styles,
        sousTitres: {
          ...style,
          valeur: {
            ...style.valeur,
            texteEcran: {
              ...reglages,
              marqueur: { teinte, cible },
              ...(pave && pave !== "-" ? { pave: { mots: pave } } : {}),
            } as typeof reglages,
          },
        },
      },
      entrees: {
        ...commande.entrees,
        [CLE_ENTREE_BIBLIOTHEQUE]: { ...entree, choix: [...(entree.choix ?? []), { capacite: ID.texteStyleVarie, cle, signature: cle }] },
      },
    };
    return lireEntreeBibliotheque(nouvelle.entrees) ? nouvelle : commande;
  } catch {
    return commande;
  }
}
