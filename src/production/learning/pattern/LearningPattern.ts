import { ILearningArtifact } from "../contracts/ILearningArtifact";
import { PatternType } from "./PatternType";
import { PatternEvidence } from "./PatternEvidence";
import { PatternConfidence } from "./PatternConfidence";

/**
 * An AI-identified recurrence of behavior or outcome extracted from Experiences.
 * A pattern does not constitute formal knowledge until it is synthesized and validated.
 */
export interface LearningPattern extends ILearningArtifact {
  readonly type: PatternType;
  
  /** The semantic description of the discovered pattern */
  readonly description: string;
  
  /** The evidence tying this pattern back to objective experiences that support it */
  readonly supportingEvidence: readonly PatternEvidence[];
  
  /** The evidence tying this pattern back to objective experiences that contradict it */
  readonly contradictingEvidence: readonly PatternEvidence[];
  
  /** The total number of experiences analyzed to extract this pattern (e.g., 27) */
  readonly coverage: number;
  
  /** The structured confidence of this pattern */
  readonly confidence: PatternConfidence;
}
