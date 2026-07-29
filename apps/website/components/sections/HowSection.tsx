import { CheckIcon, DocumentIcon, PlusHouseIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const steps = [
  {
    icon: PlusHouseIcon,
    title: "Tilføj din bolig",
    copy: "Opret boligen i Matriva og saml det grundlæggende udgangspunkt ét sted.",
  },
  {
    icon: DocumentIcon,
    title: "Få boligoplysninger og anbefalinger",
    copy: "Se registrerede offentlige boligoplysninger, og få Matrivas forslag til relevante vedligeholdelsesopgaver.",
  },
  {
    icon: CheckIcon,
    title: "Planlæg og dokumentér",
    copy: "Planlæg opgaver og deadlines, gem historik og noter. Dokumentér dine forbedringer af boligen.",
  },
];

export function HowSection() {
  return (
    <section className="how-section" id="saadan-virker-det">
      <Container>
        <div className="how-panel">
          <h2 className="how-panel__title">Sådan virker det</h2>

          <div className="steps">
            {steps.map(({ icon: Icon, title, copy }, index) => (
              <article className="step" key={title}>
                <div>
                  <span className="step__number">{index + 1}</span>
                  <div className="icon-box">
                    <Icon width="44" height="44" />
                  </div>
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
