import * as React from "react";

import { richSegments } from "@/lib/cotizador/terms";
import type { QuoteTerms } from "@/lib/settings/documents";

/** Las Condiciones Generales (sin el título): intro y secciones con sus puntos. */
export function TermsBody({ terms }: { terms: QuoteTerms }) {
  return (
    <>
      {terms.intro && <p className="mt-3 italic">{terms.intro}</p>}
      {terms.sections.map((section, si) => (
        <section key={si} className="mt-3">
          <h3 className="font-semibold text-foreground">{section.title}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {section.items.map((item, i) => (
              <li key={i}>
                <Rich text={typeof item === "string" ? item : item.text} />
                {typeof item !== "string" && (
                  <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
                    {item.sub.map((sub, j) => (
                      <li key={j}>
                        <Rich text={sub} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Texto con `**negritas**`. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {richSegments(text).map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {seg.text}
          </strong>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </>
  );
}
