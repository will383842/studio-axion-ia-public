/**
 * Page A4 imprimable du document promis (charte terracotta des pièces clients). Reçoit le document tout fait
 * (`documentDuCas`). À l'écran la page couvre le menu du studio ; à l'impression seule la page sort.
 */
import type { DocumentCasConcret } from "@/formats/cas-concret/document";

/** Quatre couleurs et une police de la charte ; la session locale peut en passer d'autres. */
export interface CharteDocument {
  principale: string;
  accent: string;
  fond: string;
  texte: string;
  police: string;
}

export const CHARTE_TERRACOTTA: CharteDocument = {
  principale: "#b4512a",
  accent: "#e07040",
  fond: "#fff6ec",
  texte: "#2b1a12",
  police: "Georgia, 'Times New Roman', serif",
};

export function DocumentPromis({ document: d, charte = CHARTE_TERRACOTTA }: { document: DocumentCasConcret; charte?: CharteDocument }) {
  const titreSection = { color: charte.principale, borderColor: charte.accent };
  return (
    <>
      <style>{"@page { size: A4; margin: 14mm; }"}</style>
    <article
      aria-label={d.titre}
      className="mx-auto w-full max-w-[210mm] bg-white p-[14mm] text-[11pt] leading-relaxed shadow-lg print:max-w-none print:p-0 print:shadow-none"
      style={{ color: charte.texte, fontFamily: charte.police }}
    >
      <header className="mb-6 border-b-4 pb-4" style={{ borderColor: charte.principale }}>
        <h1 className="text-[22pt] font-bold leading-tight" style={{ color: charte.principale }}>{d.titre}</h1>
        <p className="mt-1 text-[12pt]">{d.sousTitre}</p>
      </header>
      <p className="mb-6">{d.introduction}</p>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Le principe</h2>
        <p>
          Avant : {d.principe.avant.join(", ")}.{d.principe.total ? ` ${d.principe.total}, pour chaque personne.` : ""}
        </p>
        <p>Aujourd&apos;hui : {d.principe.apres}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Les étapes</h2>
        <ol className="space-y-2">
          {d.etapes.map((e) => (
            <li key={e.numero} className="list-none break-inside-avoid rounded p-2" style={{ backgroundColor: charte.fond }}>
              <p>
                <strong style={{ color: charte.principale }}>{e.numero}. {e.titre}</strong> · {e.ligne}
              </p>
              <p className="text-[10pt]">{e.detail}</p>
              <p className="text-[10pt]"><em>Ce qu&apos;il vous faut : {e.besoin}.</em></p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Ce qu&apos;il faut pour le mettre en place</h2>
        <ul className="list-disc pl-5">
          {d.miseEnPlace.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Ce qui reste humain</h2>
        <p>{d.resteHumain}</p>
      </section>

      {d.reperes.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Des repères</h2>
          <ul className="list-disc pl-5">
            {d.reperes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 border-b text-[14pt] font-bold" style={titreSection}>Les limites</h2>
        <ul className="list-disc pl-5">
          {d.limites.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="mb-4 break-inside-avoid rounded p-4 text-center" style={{ backgroundColor: charte.principale, color: charte.fond }}>
        <h2 className="text-[14pt] font-bold">{d.appel.titre}</h2>
        <p className="mt-1">
          <a href={d.appel.lien} className="font-bold underline">{d.appel.bouton}</a>
        </p>
        <p className="mt-1 text-[9pt] break-all">{d.appel.lien}</p>
      </section>
      <footer className="text-center text-[9pt]">{d.signature}</footer>
    </article>
    </>
  );
}
