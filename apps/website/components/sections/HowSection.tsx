import { CheckIcon, DocumentIcon, PlusHouseIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const steps = [
  {
    icon: PlusHouseIcon,
    title: "Tilføj dit hus",
    copy: "Opret din bolig og få et udgangspunkt baseret på bygningens data.",
  },
  {
    icon: DocumentIcon,
    title: "Saml dine oplysninger",
    copy: "Tilføj dokumenter og oplysninger om dit hus – vi samler det hele ét sted.",
  },
  {
    icon: CheckIcon,
    title: "Få overblik",
    copy: "Få indsigt, påmindelser og anbefalinger, så du altid er ét skridt foran.",
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
