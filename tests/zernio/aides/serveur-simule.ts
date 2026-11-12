/**
 * Faux serveur Zernio « à état » (aucun réseau) : mémorise les posts créés et déduplique par clé d'idempotence
 * comme le vrai serveur (409 + existingPostId). Données 100 % fictives.
 */
import { postExemple, type AppelEnregistre, type ReponsePreparee } from "./faux-zernio";

export function serveurSimule(opts: { surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined; tiktok?: { comment: boolean; duet: boolean; stitch: boolean } } = {}) {
  const posts = new Map<string, ReturnType<typeof postExemple>>();
  const parCle = new Map<string, string>();
  const tt = opts.tiktok ?? { comment: true, duet: false, stitch: true };
  const repondre = (a: AppelEnregistre): ReponsePreparee => {
    const sur = opts.surmesure?.(a);
    if (sur) return sur;
    const u = a.url;
    if (u.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.bin" } };
    if (u.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (u.endsWith("/tiktok/creator-info")) return { statut: 200, corps: { privacyLevels: [{ value: "PUBLIC_TO_EVERYONE" }, { value: "SELF_ONLY" }], postingLimits: { interactionSettings: { allow_comment: { enabled: tt.comment }, allow_duet: { enabled: tt.duet }, allow_stitch: { enabled: tt.stitch } } } } };
    if (a.methode === "POST" && u.endsWith("/v1/posts")) {
      const cle = a.entetes["Idempotency-Key"];
      const deja = parCle.get(cle);
      if (deja) return { statut: 409, corps: { error: "duplicate", details: { existingPostId: deja } } };
      const corps = a.json as { metadata?: Record<string, string>; isDraft?: boolean; platforms: { accountId: string }[] };
      const id = `exemple-post-${posts.size + 1}`;
      posts.set(id, postExemple({ _id: id, status: corps.isDraft ? "draft" : "scheduled", metadata: corps.metadata, platforms: [{ platform: "instagram", accountId: corps.platforms[0].accountId, status: "pending" }] }));
      parCle.set(cle, id);
      return { statut: 201, corps: { post: posts.get(id) } };
    }
    if (a.methode === "GET" && /\/v1\/posts\/[^/?]+$/.test(u.split("?")[0])) {
      const p = posts.get(u.split("?")[0].split("/").pop()!);
      return p ? { statut: 200, corps: { post: p } } : { statut: 404, corps: {} };
    }
    if (a.methode === "GET" && u.includes("/v1/posts")) return { statut: 200, corps: { posts: [...posts.values()] } };
    return { statut: 404, corps: {} };
  };
  return { repondre, posts };
}

