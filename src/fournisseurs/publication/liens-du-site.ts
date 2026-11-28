/**
 * Lien d'une épingle : il doit mener au site (ADR-0015). Pure, sans réseau.
 * Règle : https seulement, sans identifiants ni port, et hôte EXACTEMENT égal au domaine du site (un sous-domaine est refusé).
 * Le domaine vient du réglage `site.domaine` (défaut : l'hôte de `BASE_PUBLIQUE`) ; vide ou illisible = tout lien est refusé.
 * Note : `lienDeChezNous` (messages de l'inbox) garde sa propre règle (sous-domaines permis) dans zernio-inbox-corps.ts, non touché ici.
 */
export function lienDuSite(lien: string, domaine: string | undefined | null): boolean {
  const dom = (domaine ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!dom) return false;
  let u: URL;
  try {
    u = new URL(lien.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.port !== "") return false;
  return u.hostname.toLowerCase().replace(/\.$/, "") === dom;
}
