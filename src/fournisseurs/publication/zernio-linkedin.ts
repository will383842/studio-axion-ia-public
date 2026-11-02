/**
 * LINKEDIN · une organisation vue par plusieurs comptes Zernio (FIX-LINKEDIN).
 * Un compte « organisation » et un compte « profil personnel » peuvent exposer la MÊME organisation : on ne garde qu'un canal
 * par organisation, tenu par le compte de type organisation dont le nom ou l'identifiant correspond. Si on ne peut pas
 * trancher, tous les canaux restent : la cible est alors refusée avec un message nommé (jamais un choix au hasard).
 * Le profil personnel reste un canal distinct (« :li:profil »), géré ailleurs.
 */
import { compteLinkedinEstProfil } from "./zernio-corps";
import type { OrganisationLinkedinZernio } from "./zernio-client";

export interface CandidatOrganisationLinkedin<C> {
  canal: C;
  compte: Record<string, unknown>;
  organisation: OrganisationLinkedinZernio;
  nomOrganisation: string;
}

const norm = (t: unknown) => (typeof t === "string" ? t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase() : "");

/** Le compte correspond-il à l'organisation (par le nom, le nom d'usage ou l'identifiant) ? */
function correspond<C>(x: CandidatOrganisationLinkedin<C>): boolean {
  const c = x.compte;
  const noms = [c.displayName, c.username].map(norm).filter(Boolean);
  const org = [x.nomOrganisation, x.organisation.name, x.organisation.localizedName, x.organisation.vanityName].map(norm).filter(Boolean);
  if (noms.some((n) => org.includes(n))) return true;
  const id = x.organisation.id;
  return ["platformUserId", "profileId", "platformId", "organizationId", "organizationUrn"].some((k) => {
    const v = c[k];
    return typeof v === "string" && (v === id || v === `urn:li:organization:${id}`);
  });
}

export function choisirCompteOrganisationLinkedin<C>(candidats: CandidatOrganisationLinkedin<C>[]): C[] {
  if (candidats.length <= 1) return candidats.map((x) => x.canal);
  const organisations = candidats.filter((x) => !compteLinkedinEstProfil(x.compte));
  const retenus = organisations.filter(correspond);
  if (retenus.length === 1) return [retenus[0].canal];
  return candidats.map((x) => x.canal);
}
