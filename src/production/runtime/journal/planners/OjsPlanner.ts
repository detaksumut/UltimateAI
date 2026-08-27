import { NormalizedRequirements } from "../RequirementNormalizer";
import { Recommendation } from "../JournalIntelligence";

export interface OjsPlan {
  readonly planId: string;
  readonly recommendedStages: string[];
}

export class OjsPlanner {
  createPlan(normalized: NormalizedRequirements, recommendations: Recommendation[]): OjsPlan {
    const isDoubleBlind = recommendations.some(rec => rec.content.includes("double-blind"));
    const recommendedStages = ["submission", "review", "revision", "editorial-decision"];
    if (isDoubleBlind) {
      recommendedStages.push("blind-review-assignment");
    }
    recommendedStages.push("publication");

    return {
      planId: `plan-${normalized.metadata.indexingTarget.join("-").toLowerCase()}`,
      recommendedStages
    };
  }
}
