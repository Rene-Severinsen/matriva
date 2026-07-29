import Image from "next/image";

import { Container } from "@/components/ui/Container";

const screens = [
  {
    eyebrow: "Boligens overblik",
    title: "Mit hus",
    subtitle: "Registrerede boligoplysninger",
    src: "/images/app/mit-hus.png",
    alt: "Matriva-appens Mit hus-visning med adresse og registrerede boligoplysninger.",
  },
  {
    eyebrow: "Planlæg arbejdet",
    title: "Vedligeholdelse",
    subtitle: "Opgaver og anbefalinger",
    src: "/images/app/vedligeholdelse.png",
    alt: "Matriva-appens vedligeholdelsesvisning med planlagte opgaver og en anbefaling.",
  },
  {
    eyebrow: "Bevar overblikket",
    title: "Historik",
    subtitle: "Udført arbejde samlet ét sted",
    src: "/images/app/historik.png",
    alt: "Matriva-appens historikvisning med udførte vedligeholdelsesopgaver.",
  },
];

export function ScreensSection() {
  return (
    <section className="screens-section" id="produktet">
      <Container>
        <header className="screens-section__header">
          <p className="screens-section__eyebrow">Produktet</p>
          <h2 className="screens-section__title">
            Fra boligoplysninger til dokumenteret vedligeholdelse
          </h2>
          <p className="section-copy">
            Tre centrale visninger samler det, du ved om boligen, det du
            planlægger, og det du allerede har fået gjort.
          </p>
        </header>

        <div className="screen-grid">
          {screens.map(({ eyebrow, title, subtitle, src, alt }) => (
            <article
              className="product-preview"
              key={title}
              aria-label={`${title}: visning fra Matriva-appen`}
            >
              <div className="product-preview__copy">
                <p>{eyebrow}</p>
                <h3>{title}</h3>
                <span>{subtitle}</span>
              </div>
              <div className="product-device">
                <Image
                  className="product-device__image"
                  src={src}
                  alt={alt}
                  width={1260}
                  height={2456}
                  sizes="(max-width: 560px) calc(100vw - 3rem), (max-width: 1100px) 22rem, 30vw"
                />
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
