import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CtaSection } from "@/components/sections/CtaSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { Hero } from "@/components/sections/Hero";
import { HowSection } from "@/components/sections/HowSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { ScreensSection } from "@/components/sections/ScreensSection";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <FeaturesSection />
        <HowSection />
        <ScreensSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
