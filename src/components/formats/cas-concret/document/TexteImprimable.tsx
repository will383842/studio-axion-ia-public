/**
 * Page A4 imprimable du texte CORRIGÉ par Will (mêmes couleurs que `DocumentPromis`). Reçoit le texte déjà contrôlé.
 */
import { CHARTE_TERRACOTTA, type CharteDocument } from "./DocumentPromis";
import { structurerTexte } from "./texte";

export function TexteImprimable({ texte, charte = CHARTE_TERRACOTTA }: { texte: string; charte?: CharteDocument }) {
  const { titre, sections } = structurerTexte(texte);
  return (
    <>
      <style>{"@page { size: A4; margin: 14mm; }"}</style>
      <article
        aria-label={titre}
        className="mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-[11pt] leading-relaxed shadow-lg print:max-w-none print:p-0 print:shadow-none"
        style={{ color: charte.texte, fontFamily: charte.police }}
      >
        <header className="mb-6 border-b-4 pb-4" style={{ borderColor: charte.principale }}>
          <h1 className="text-[22pt] font-bold leading-tight" style={{ color: charte.principale }}>{titre}</h1>
        </header>
        {sections.map((s, i) => (
          <section key={`${s.titre ?? "debut"}-${i}`} className="mb-5 break-inside-avoid">
            {s.titre && <h2 className="mb-2 border-b text-[14pt] font-bold" style={{ color: charte.principale, borderColor: charte.accent }}>{s.titre}</h2>}
            {s.lignes.map((l, j) => (l.startsWith("- ") ? <p key={j} className="pl-4">• {l.slice(2)}</p> : <p key={j}>{l}</p>))}
          </section>
        ))}
      </article>
    </>
  );
}
