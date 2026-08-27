export interface InputRequirements {
  readonly journalName?: string;
  readonly publisher?: string;
  readonly issn?: string;
  readonly indexingTarget?: string[];
  readonly reviewModel?: string;
}

export interface NormalizedRequirements {
  readonly journalName: string;
  readonly publisher: string;
  readonly issn: string;
  readonly indexingTarget: string[];
  readonly reviewModel: string;
  readonly metadata: {
    readonly normalizedAt: number;
    readonly isEnriched: boolean;
    readonly ambiguityLevel: number; // 0 = complete, 1 = minor ambiguity, 2 = critical ambiguity
  };
}

export class RequirementNormalizer {
  /**
   * Normalizer is strictly IMMUTABLE. It returns a new object.
   */
  normalize(input: InputRequirements): { normalized: NormalizedRequirements; ambiguities: string[] } {
    const ambiguities: string[] = [];
    
    // Validasi & deteksi ambiguitas
    if (!input.journalName) {
      ambiguities.push("Journal name is missing");
    }
    if (!input.publisher) {
      ambiguities.push("Publisher name is missing");
    }
    if (!input.issn) {
      ambiguities.push("ISSN / eISSN is missing");
    }
    if (!input.indexingTarget || input.indexingTarget.length === 0) {
      ambiguities.push("Indexing target is missing");
    }
    if (!input.reviewModel) {
      ambiguities.push("Review model is missing");
    }

    const ambiguityLevel = ambiguities.length === 0 ? 0 : ambiguities.length <= 2 ? 1 : 2;

    const normalized: NormalizedRequirements = {
      journalName: input.journalName || "Unnamed Journal",
      publisher: input.publisher || "Unknown Publisher",
      issn: input.issn || "0000-0000",
      indexingTarget: input.indexingTarget || [],
      reviewModel: input.reviewModel || "unknown",
      metadata: {
        normalizedAt: Date.now(),
        isEnriched: true,
        ambiguityLevel
      }
    };

    return { normalized, ambiguities };
  }
}
