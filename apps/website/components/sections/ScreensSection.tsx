import { Container } from "@/components/ui/Container";

const screens = [
  ["Overblik", ["Boligens sundhed", "82", "Næste opgaver", "3 aktive"]],
  [
    "Dokumenter",
    ["Ejerskifteforsikring", "PDF · 2025", "Tilstandsrapport", "PDF · 2025"],
  ],
  [
    "Vedligeholdelse",
    ["Rens tagrender", "Om 32 dage", "Udskift filter", "Om 59 dage"],
  ],
  [
    "Deling & adgang",
    ["Anna Severinsen", "Ejer", "Mads Severinsen", "Kan redigere"],
  ],
  ["Husets sundhed", ["Samlet score", "82", "Vedligehold", "God"]],
];

export function ScreensSection() {
  return (
    <section className="screens-section">
      <Container>
        <h2 className="screens-section__title">
          Alt det vigtige – lige ved hånden
        </h2>

        <div className="screen-grid">
          {screens.map(([title, values]) => (
            <article className="app-screen" key={title as string}>
              <div className="app-screen__top">
                <span>9:41</span>
                <span>● ●</span>
              </div>

              <h3 className="app-screen__title">{title}</h3>

              {(values as string[]).map((value, index) => (
                <div className="app-screen__card" key={`${value}-${index}`}>
                  <p className="app-screen__label">
                    {index % 2 === 0 ? value : "Status"}
                  </p>
                  <p className="app-screen__value">
                    {index % 2 === 1
                      ? value
                      : index === 0
                        ? "Se detaljer"
                        : value}
                  </p>
                  <div
                    className={`app-screen__line ${
                      index === 0 ? "app-screen__line--green" : ""
                    }`}
                  />
                </div>
              ))}
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
