// src/builder/requirement/IntentExtractor.ts

export class IntentExtractor {
  /**
   * Extracts objectives, questions, and specific intents from the user prompt text.
   */
  public extractIntents(prompt: string): { objectives: string[]; questions: string[]; type: string } {
    const objectives: string[] = [];
    const questions: string[] = [];
    let type = 'General';

    // Simple rule-based extraction for local fallback / augmentation
    const lines = prompt.split(/[.\n]/).map(l => l.trim()).filter(Boolean);
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('to study') || lower.startsWith('study the') || lower.startsWith('evaluate') || lower.startsWith('analyze')) {
        objectives.push(line);
      } else if (line.endsWith('?') || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why')) {
        questions.push(line);
      }
    }

    // Default objectives if none found
    if (objectives.length === 0) {
      objectives.push(`Analyze and collect data for: "${prompt.slice(0, 60)}..."`);
    }

    // Classify discipline type
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('amphibian') || lowerPrompt.includes('biology') || lowerPrompt.includes('growth') || lowerPrompt.includes('temperature')) {
      type = 'Biological Science';
    } else if (lowerPrompt.includes('gdpr') || lowerPrompt.includes('legal') || lowerPrompt.includes('law') || lowerPrompt.includes('business')) {
      type = 'Legal / Regulatory';
    } else if (lowerPrompt.includes('learning') || lowerPrompt.includes('education') || lowerPrompt.includes('classroom')) {
      type = 'Educational Research';
    } else if (lowerPrompt.includes('carbon') || lowerPrompt.includes('tax') || lowerPrompt.includes('emission') || lowerPrompt.includes('policy')) {
      type = 'Public Policy';
    }

    return {
      objectives,
      questions,
      type
    };
  }
}
