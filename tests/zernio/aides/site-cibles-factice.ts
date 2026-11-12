/**
 * Faux site du catalogue (MG-1) : aucun réseau. Hôte `exemple.test`, valeurs 100 % FICTIVES.
 * Il vérifie la signature comme le vrai site (même fonction que le Studio) et répond dans la forme de la PR site #1969.
 */
import {
  ENTETE_HORODATAGE,
  ENTETE_NONCE,
  ENTETE_SIGNATURE,
  signatureValide,
} from "@/fournisseurs/site/signature";
import type {
  RequeteSignee,
  ReponseSite,
  TransportSite,
} from "@/fournisseurs/site/types";

export const SECRET_FICTIF = "secret-fictif-pour-les-essais-0123456789abcdef";
export const ENV_SITE_FICTIF = {
  SITE_GUIDES_RESEAU_SECRET: SECRET_FICTIF,
  SITE_VIDEOS_URL: "https://exemple.test",
} as const;
export const HOTE_FICTIF = "exemple.test";

interface CibleSite {
  code: string;
  type: "guide" | "adresse";
  titre: string;
  actif: boolean;
  test: boolean;
  /** Champs que le vrai site ne renvoie pas : le faux les ajoute pour vérifier que le Studio ne les garde pas. */
  url?: string | null;
  cheminPdf?: string | null;
}
interface LiaisonSite {
  mot: string;
  reseau: string;
  codeCible: string;
  actif: boolean;
}

export function siteCiblesFactice() {
  const appels: RequeteSignee[] = [];
  const cibles: CibleSite[] = [
    {
      code: "gde-essai01",
      type: "guide",
      titre: "Guide fictif A",
      actif: true,
      test: false,
      cheminPdf: "guides/fictif-a.pdf",
    },
    {
      code: "adr-essai0000001",
      type: "adresse",
      titre: "Page fictive B",
      actif: true,
      test: false,
      url: `https://${HOTE_FICTIF}/page-b`,
    },
    {
      code: "gde-essai02",
      type: "guide",
      titre: "Guide fictif C",
      actif: false,
      test: true,
      cheminPdf: "guides/fictif-c.pdf",
    },
  ];
  const liaisons: LiaisonSite[] = [
    { mot: "tous1", reseau: "tous", codeCible: "gde-essai01", actif: true },
    {
      mot: "tous1",
      reseau: "instagram",
      codeCible: "adr-essai0000001",
      actif: true,
    },
  ];
  const etat = {
    panne: false,
    statutForce: null as number | null,
    corpsForce: undefined as unknown,
    secret: SECRET_FICTIF,
  };

  const rep = (statut: number, corps: unknown): ReponseSite => ({
    statut,
    corps,
  });
  const refus = (statut: number, erreur: string) =>
    rep(statut, { ok: false, erreur });

  const transport: TransportSite = async (r) => {
    appels.push(r);
    if (etat.panne) throw new Error("injoignable");
    if (etat.statutForce !== null)
      return rep(
        etat.statutForce,
        etat.corpsForce ?? { ok: false, erreur: "introuvable" },
      );
    const h = r.entetes;
    const ok = signatureValide(etat.secret, {
      methode: r.methode,
      chemin: r.chemin,
      corps: r.corps,
      horodatage: h[ENTETE_HORODATAGE] ?? "",
      nonce: h[ENTETE_NONCE] ?? "",
      signature: h[ENTETE_SIGNATURE] ?? "",
    });
    if (!ok) return refus(401, "signature_invalide");
    if (r.methode === "GET" && r.chemin === "/api/interne/catalogue-reseau")
      return rep(200, cibles);
    if (r.methode === "GET" && r.chemin === "/api/interne/mots-cibles")
      return rep(200, liaisons);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(r.corps) as Record<string, unknown>;
    } catch {
      return refus(400, "corps_illisible");
    }
    if (r.methode === "POST" && r.chemin === "/api/interne/cibles-reseau") {
      const titre = typeof json.titre === "string" ? json.titre.trim() : "";
      if (titre.length < 3) return refus(422, "titre_invalide");
      const type = json.type === "guide" ? "guide" : "adresse";
      const code = String(json.code ?? "");
      if (type === "adresse") {
        const u = typeof json.url === "string" ? json.url : "";
        if (!u.startsWith("https://"))
          return refus(422, "adresse_https_obligatoire");
        if (new URL(u).hostname !== HOTE_FICTIF)
          return refus(422, "adresse_hote_non_autorise");
      }
      const i = cibles.findIndex((c) => c.code === code);
      const nouvelle: CibleSite = {
        code,
        type,
        titre,
        actif: json.actif !== false,
        test: json.test === true,
        url: (json.url as string | undefined) ?? null,
        cheminPdf: (json.cheminPdf as string | undefined) ?? null,
      };
      if (i >= 0) cibles[i] = nouvelle;
      else cibles.push(nouvelle);
      return rep(200, { ok: true, code });
    }
    if (r.methode === "POST" && r.chemin === "/api/interne/mots-cibles") {
      const mot = String(json.mot ?? "");
      if (!/^[a-z0-9]{2,30}$/.test(mot)) return refus(422, "mot_invalide");
      const cible = cibles.find((c) => c.code === json.codeCible);
      if (!cible) return refus(422, "cible_inconnue");
      if (!cible.actif) return refus(422, "cible_inactive");
      const reseau = String(json.reseau);
      const actif = json.actif !== false;
      const i = liaisons.findIndex((l) => l.mot === mot && l.reseau === reseau);
      const l = { mot, reseau, codeCible: cible.code, actif };
      if (i >= 0) liaisons[i] = l;
      else liaisons.push(l);
      return rep(200, { ok: true, mot, reseau, codeCible: cible.code });
    }
    return refus(404, "introuvable");
  };
  return { transport, appels, cibles, liaisons, etat };
}
