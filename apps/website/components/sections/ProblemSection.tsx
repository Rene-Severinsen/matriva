import { CalendarIcon, FolderIcon, ShieldIcon } from "@/components/ui/Icons";
import { Container } from "@/components/ui/Container";

const items = [
  {
    icon: FolderIcon,
    title: "Oplysningerne ligger spredt",
    copy: "Boligoplysninger, kvitteringer og dokumenter ender let i forskellige mapper, indbakker og systemer.",
  },
  {
    icon: CalendarIcon,
    title: "Hvad skal gøres hvornår?",
    copy: "Det kan være svært at vurdere, hvilke vedligeholdelsesopgaver der er relevante, og hvornår de bør udføres.",
  },
  {
    icon: ShieldIcon,
    title: "Historikken mangler",
    copy: "Hvad blev lavet, hvornår blev det gjort, og hvilke opgaver skal følges op næste gang?",
  },
];

export function ProblemSection() {
  return (
    <section className="problem-section" id="udfordringer">
      <Container>
        <h2 className="problem-section__title">Kender du det?</h2>

        <div className="problem-grid">
          {items.map(({ icon: Icon, title, copy }) => (
            <article className="problem-card" key={title}>
              <div className="icon-box">
                <Icon width="45" height="45" />
              </div>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
