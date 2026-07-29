import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { HouseMark } from "@/components/ui/Icons";

export function CtaSection() {
  return (
    <section className="cta-section" id="status">
      <Container>
        <div className="cta-band">
          <div className="cta-band__mark">
            <HouseMark width="46" height="46" />
          </div>

          <div>
            <h2>Matriva er under udvikling</h2>
            <p>
              Vi bygger et samlet boligoverblik med vedligeholdelsesopgaver,
              historik og dokumentation. Appen er endnu ikke lanceret.
            </p>
          </div>

          <Button href="mailto:hej@matriva.dk">Kontakt Matriva</Button>
        </div>
      </Container>
    </section>
  );
}
