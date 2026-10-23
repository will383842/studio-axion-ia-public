import { z } from "zod";
import { CarrouselSpec, texteSansLien } from "../../domaine/visuels/schema";
import type { DemandeTexteCarrousel, FournisseurTexteCarrousel, ReponseTexteCarrousel } from "../../domaine/visuels/contrats";
import { ErreurTexteCarrousel } from "./verrou-api";

export { ErreurTexteCarrousel };

/** Taille maximale d'un paquet de session, en octets (64 Ko). */
export const TAILLE_PAQUET_MAX = 64 * 1024;

const Paquet = z
  .object({
    version: z.literal("paquet-session-carrousel/1"),
    sujet: texteSansLien(1, 200),
    titre: texteSansLien(1, 120),
    pourquoi: z.array(texteSansLien(1, 200)).max(10),
    spec: CarrouselSpec,
  })
  .strict()
  .superRefine((paquet, ctx) => {
    if (paquet.pourquoi.length !== paquet.spec.pages.length) {
      ctx.addIssue({ code: "custom", path: ["pourquoi"], message: "Une phrase de pourquoi par page" });
    }
    if (paquet.spec.pages.at(-1)?.type !== "T21") {
      ctx.addIssue({ code: "custom", path: ["spec", "pages"], message: "La dernière page est la page sombre T21" });
    }
  });

function phrase(issue: z.core.$ZodIssue): string {
  const chemin = issue.path.map(String).join(".") || "(racine du paquet)";
  const i = issue as unknown as Record<string, unknown>;
  let detail: string;
  switch (issue.code) {
    case "unrecognized_keys":
      detail = `clé inconnue « ${(i.keys as string[]).join(" », « ")} »`;
      break;
    case "too_big":
      detail = `trop long ou trop nombreux (${String(i.maximum)} au plus)`;
      break;
    case "too_small":
      detail = `trop court ou trop peu nombreux (${String(i.minimum)} au moins)`;
      break;
    case "invalid_type":
      detail = "valeur absente ou du mauvais type";
      break;
    case "invalid_value":
      detail = "valeur non admise";
      break;
    case "invalid_union":
      detail = "type de page inconnu ou page mal formée";
      break;
    default:
      detail = issue.message.replace(/[.\s]+$/u, "");
  }
  return `Champ « ${chemin} » : ${detail}.`;
}

/** Lit le contenu d'un paquet de session (JSON) ; toute erreur est une phrase claire en français avec le chemin du champ. */
export function lirePaquetSession(contenu: string): ReponseTexteCarrousel {
  if (new TextEncoder().encode(contenu).length > TAILLE_PAQUET_MAX) {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", "Le paquet dépasse 64 Ko : il est refusé.");
  }
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", "Le paquet n'est pas un JSON lisible : vérifier les accolades, les guillemets et les virgules.");
  }
  const lu = Paquet.safeParse(brut);
  if (!lu.success) {
    throw new ErreurTexteCarrousel("PAQUET_INVALIDE", `Le paquet est refusé. ${lu.error.issues.slice(0, 5).map(phrase).join(" ")}`);
  }
  const { titre, pourquoi, spec } = lu.data;
  return { titre, pourquoi, spec, mode: "session" };
}

/** Fournisseur « session » : n'accepte que les paquets produits par une session Claude (abonnement). */
export function creerFournisseurSession(): FournisseurTexteCarrousel {
  return {
    mode: "session",
    async ecrire(demande: DemandeTexteCarrousel): Promise<ReponseTexteCarrousel> {
      if (demande.type !== "paquet-session") {
        throw new ErreurTexteCarrousel("SESSION_ATTENDUE", "Ce fournisseur lit seulement un paquet de session.");
      }
      return lirePaquetSession(demande.contenu);
    },
  };
}
