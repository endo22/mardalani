import { LandingHero } from "@/components/landing/hero";
import {
  DestinationRail,
  FinalCta,
  HowItWorks,
  ProblemSolution,
} from "@/components/landing/sections";
import { SiteHeader } from "@/components/layout/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader transparent />
      <main id="main">
        <LandingHero />
        <ProblemSolution />
        <HowItWorks />
        <DestinationRail />
        <FinalCta />
      </main>
    </>
  );
}
