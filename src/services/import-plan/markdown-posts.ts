/**
 * L4-10 — Lecteur des posts en Markdown : « ## Post <n> », puis « ### Texte » et « ### Premier commentaire ».
 */
import { ErreurFormatPlan, type TextesPost } from "./formats";

export function lirePostsMarkdown(texte: string): Map<number, TextesPost> {
  const posts = new Map<number, TextesPost>();
  const blocs = texte.replace(/\r\n/g, "\n").split(/^## Post\s+(\d+)\s*$/m);
  for (let i = 1; i < blocs.length; i += 2) {
    const numero = Number(blocs[i]);
    if (posts.has(numero)) throw new ErreurFormatPlan(`Post ${numero} en double dans le Markdown.`);
    const [avant, ...apres] = blocs[i + 1].split(/^### Premier commentaire\s*$/m);
    const m = /^### Texte\s*\n([\s\S]*)$/m.exec(avant);
    if (!m) throw new ErreurFormatPlan(`Post ${numero} : section « Texte » absente.`);
    posts.set(numero, { texte: m[1].trim(), premierCommentaire: apres.join("").trim() });
  }
  return posts;
}
