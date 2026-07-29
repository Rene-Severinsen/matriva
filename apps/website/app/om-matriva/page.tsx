import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Om Matriva – Overblik over dit hus",
  description:
    "Læs hvorfor Matriva udvikles, og hvordan appen skal hjælpe danske husejere med boligoplysninger, vedligeholdelse, dokumentation og historik.",
};

const challenges = [
  {
    number: "01",
    title: "Oplysningerne ligger forskellige steder",
    copy: "Dokumenter, kvitteringer og boligoplysninger ender let i mapper, indbakker, ringbind og forskellige digitale tjenester.",
  },
  {
    number: "02",
    title: "Vedligeholdelse bliver ofte reaktiv",
    copy: "Opgaver bliver let udskudt, indtil et problem opstår, fordi det kan være svært at vide, hvad der bør følges op på og hvornår.",
  },
  {
    number: "03",
    title: "Historikken forsvinder over tid",
    copy: "Det er ikke altid nemt at huske, hvad der blev lavet, hvilke materialer der blev brugt, og hvornår arbejdet bør gentages.",
  },
];

const operatingSteps = [
  {
    title: "Forstå boligen",
    copy: "Saml registrerede boligoplysninger og dine egne oplysninger om huset.",
  },
  {
    title: "Planlæg arbejdet",
    copy: "Få struktur på relevante opgaver og det, der bør ske næste gang.",
  },
  {
    title: "Dokumentér det udførte",
    copy: "Gem oplysninger og dokumentation, mens arbejdet stadig er let at huske.",
  },
  {
    title: "Bevar historikken",
    copy: "Opbyg et anvendeligt overblik over boligens udvikling gennem tiden.",
  },
];

export default function AboutMatrivaPage() {
  return (
    <>
      <Header />

      <main>
        <section className="about-hero">
          <Container>
            <div className="about-hero__content">
              <p className="about-eyebrow">Om Matriva</p>

              <h1 className="about-hero__title">
                Det skal være lettere at have ansvar for et hus
              </h1>

              <p className="about-hero__lead">
                Matriva er skabt til danske husejere, der ønsker et bedre
                overblik over boligens oplysninger, dokumenter og løbende
                vedligeholdelse.
              </p>

              <p className="about-hero__copy">
                Et hus kræver opmærksomhed gennem mange år. Der bliver udført
                reparationer, udskiftet installationer, gemt kvitteringer og
                truffet beslutninger, som senere kan være svære at huske.
                Matriva skal gøre det lettere at bevare sammenhængen.
              </p>
            </div>
          </Container>
        </section>

        <section className="about-problem">
          <Container>
            <div className="about-section-heading">
              <p className="about-eyebrow">Hvorfor Matriva findes</p>
              <h2 className="section-heading">
                Et hus skaber oplysninger gennem hele sin levetid
              </h2>
              <p className="section-copy">
                Mange husejere mangler ikke flere oplysninger. De mangler et
                samlet sted, hvor oplysningerne kan forstås og bruges i den
                løbende drift af huset.
              </p>
            </div>

            <div className="about-challenge-grid">
              {challenges.map((challenge) => (
                <article className="about-challenge" key={challenge.number}>
                  <span className="about-challenge__number" aria-hidden="true">
                    {challenge.number}
                  </span>
                  <h3>{challenge.title}</h3>
                  <p>{challenge.copy}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        <section className="about-connection">
          <Container>
            <div className="about-connection__grid">
              <div>
                <p className="about-eyebrow">Ét samlet udgangspunkt</p>
                <h2 className="section-heading">
                  Oplysningerne giver først værdi, når de hænger sammen
                </h2>
              </div>

              <div className="about-connection__copy">
                <p>
                  Matriva er mere end et sted at gemme dokumenter og mere end en
                  liste over opgaver.
                </p>
                <p>
                  Boligens registrerede oplysninger, husejerens egne dokumenter,
                  relevante vedligeholdelsesopgaver og historikken over det
                  udførte skal kunne ses i sammenhæng.
                </p>
                <p>
                  Det gør det lettere at forstå, hvad boligen består af, hvad
                  der allerede er gjort, og hvad der kræver opmærksomhed næste
                  gang.
                </p>
              </div>
            </div>

            <blockquote className="about-statement">
              Et dokumentarkiv gemmer filer. En opgaveliste husker handlinger.
              Matriva forbinder oplysningerne med huset og det ansvar, der
              følger med.
            </blockquote>
          </Container>
        </section>

        <section className="about-operation">
          <Container>
            <div className="about-section-heading">
              <p className="about-eyebrow">Løbende drift</p>
              <h2 className="section-heading">
                Huset stopper ikke, når dokumentet er gemt
              </h2>
              <p className="section-copy">
                Matriva handler om planlægning, opfølgning og dokumentation
                gennem hele den tid, du har ansvar for huset.
              </p>
            </div>

            <ol className="about-steps">
              {operatingSteps.map((step, index) => (
                <li className="about-step" key={step.title}>
                  <span className="about-step__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section className="about-development">
          <Container>
            <div className="about-development__panel">
              <div className="about-development__content">
                <p className="about-eyebrow">Produktets retning</p>
                <h2 className="section-heading">
                  Matriva udvikles trin for trin
                </h2>

                <p>
                  Matriva er under udvikling til iPhone og Android. Produktet
                  bygges med udgangspunkt i de praktiske behov, der opstår i den
                  løbende drift af et hus.
                </p>

                <p>
                  Offentligt tilgængelige boligoplysninger skal spille sammen
                  med de oplysninger og den dokumentation, som husejeren selv
                  tilføjer.
                </p>

                <p>
                  Funktionerne udvikles trin for trin. Målet er ikke at gøre
                  boligejerskab kompliceret, men at gøre den eksisterende
                  kompleksitet lettere at håndtere.
                </p>
              </div>

              <div className="about-development__actions">
                <Button href="/#saadan-virker-det">
                  Se hvordan Matriva virker
                </Button>
                <Button href="mailto:hej@matriva.dk" variant="secondary">
                  Kontakt Matriva
                </Button>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
