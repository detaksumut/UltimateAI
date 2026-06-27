import fs from 'fs';
import path from 'path';

export class PromptBuilder {
    private basePath = path.join(process.cwd(), 'src', 'cognition', 'instructions');

    constructor() {}

    /**
     * Builds a prompt by reading an instruction file and injecting context/memory.
     */
    public async build(instructionName: string, variables: Record<string, string>): Promise<string> {
        const filePath = path.join(this.basePath, `${instructionName}.md`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`[Cognition] Instruction file not found: ${instructionName}.md`);
        }

        let rawInstruction = fs.readFileSync(filePath, 'utf-8');

        // Replace template variables
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rawInstruction = rawInstruction.replace(regex, value);
        }

        // Future injection of Dynamic Knowledge, Context, and History happens here.
        // const dynamicKnowledge = await contextBuilder.fetchRelevantKnowledge(variables.USER_INPUT);
        // rawInstruction = `[SYSTEM KNOWLEDGE]\n${dynamicKnowledge}\n\n${rawInstruction}`;

        return rawInstruction;
    }
}
