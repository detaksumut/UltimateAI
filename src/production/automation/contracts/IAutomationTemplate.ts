/**
 * IAutomationTemplate.ts
 *
 * Defines the contract for zero-touch automation templates.
 * When the Blueprint Generator requests an automation configuration,
 * the Template Generator exports the workflow configuration (e.g., JSON file).
 */

export interface IAutomationTemplate {
  readonly templateId: string;
  readonly domain: string; // e.g., 'survey', 'certification'
  readonly providerId: string; // e.g., 'n8n', 'temporal'
  
  /**
   * Generates the raw configuration file content for the specific provider.
   * @param parameters The contextual variables from the Generator (e.g., webhook URL, table names).
   * @returns The stringified configuration (JSON, YAML, etc) ready to be exported.
   */
  generateConfig(parameters: Record<string, any>): string;
}
