// src/builder/requirement/VariableDetector.ts

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

export class VariableDetector {
  /**
   * Detects independent and dependent variables from the user prompt
   * and recommends appropriate form parameters.
   */
  public detectVariables(prompt: string): {
    independent: string[];
    dependent: string[];
    parameters: Parameter[];
  } {
    const independent: string[] = [];
    const dependent: string[] = [];
    const parameters: Parameter[] = [];

    const lower = prompt.toLowerCase();

    // Default parameters that are always useful
    parameters.push({ name: 'Subject ID/Name', type: 'text', required: true });
    parameters.push({ name: 'Observation Date', type: 'date', required: true });

    if (lower.includes('temperature') || lower.includes('embryo') || lower.includes('amphibian')) {
      independent.push('Temperature (°C)');
      dependent.push('Embryo Development Rate');
      dependent.push('Survival Rate');

      parameters.push({ name: 'Temperature (°C)', type: 'number', required: true });
      parameters.push({ name: 'Development Stage', type: 'dropdown', required: true, options: ['Blastula', 'Gastrula', 'Neurula', 'Hatching'] });
      parameters.push({ name: 'Heart Rate (bpm)', type: 'number', required: false });
      parameters.push({ name: 'Survival Status', type: 'dropdown', required: true, options: ['Alive', 'Dead', 'Deformed'] });
    } else if (lower.includes('gdpr') || lower.includes('legal') || lower.includes('business')) {
      independent.push('GDPR Implementation Cost');
      dependent.push('Compliance Status');
      dependent.push('Business Size');

      parameters.push({ name: 'Business Size', type: 'dropdown', required: true, options: ['Micro (<10)', 'Small (10-49)', 'Medium (50-249)', 'Large (250+)'] });
      parameters.push({ name: 'Compliance Rate (%)', type: 'number', required: true });
      parameters.push({ name: 'GDPR Budget (EUR)', type: 'number', required: false });
      parameters.push({ name: 'Data Protection Officer Assigned', type: 'checkbox', required: false });
    } else if (lower.includes('learning') || lower.includes('classroom') || lower.includes('education')) {
      independent.push('Learning Mode (Online vs Traditional)');
      dependent.push('Student Engagement');
      dependent.push('Assessment Scores');

      parameters.push({ name: 'Learning Mode', type: 'dropdown', required: true, options: ['Online', 'Traditional Classroom', 'Hybrid'] });
      parameters.push({ name: 'Engagement Level (1-5)', type: 'number', required: true });
      parameters.push({ name: 'Assessment Score', type: 'number', required: true });
      parameters.push({ name: 'Class Attendance (%)', type: 'number', required: false });
    } else if (lower.includes('carbon') || lower.includes('tax') || lower.includes('emission')) {
      independent.push('Carbon Tax Rate');
      dependent.push('CO2 Emissions (metric tons)');
      dependent.push('Energy Source');

      parameters.push({ name: 'Tax Rate per Ton', type: 'number', required: true });
      parameters.push({ name: 'CO2 Emissions (tons)', type: 'number', required: true });
      parameters.push({ name: 'Primary Energy Source', type: 'dropdown', required: true, options: ['Coal', 'Natural Gas', 'Solar', 'Wind', 'Hydro', 'Nuclear'] });
      parameters.push({ name: 'Subsidies Received', type: 'checkbox', required: false });
    } else {
      // General fallback variables
      independent.push('Independent Treatment Variable');
      dependent.push('Dependent Measurement Outcome');

      parameters.push({ name: 'Treatment Level', type: 'text', required: true });
      parameters.push({ name: 'Measured Value', type: 'number', required: true });
      parameters.push({ name: 'Notes', type: 'textarea', required: false });
    }

    return {
      independent,
      dependent,
      parameters
    };
  }
}
