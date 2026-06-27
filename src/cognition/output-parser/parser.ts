export class OutputParser {
    /**
     * Parses a string into JSON, handling Markdown code block wrappings
     */
    public parseJson<T>(rawString: string): T {
        try {
            let cleanString = rawString;
            const match = cleanString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                cleanString = match[1];
            } else {
                const start = cleanString.indexOf('{');
                const end = cleanString.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    cleanString = cleanString.substring(start, end + 1);
                }
            }
            return JSON.parse(cleanString.trim()) as T;
        } catch (error) {
            console.error('[OutputParser] Failed to parse JSON:', rawString);
            throw new Error('Output parsing failed. LLM did not return valid JSON.');
        }
    }

    /**
     * Parses a raw HTML string, stripping any accidental markdown blocks
     */
    public parseHtml(rawString: string): string {
        let cleanString = rawString.trim();
        if (cleanString.startsWith('\`\`\`html')) {
            cleanString = cleanString.replace(/\`\`\`html/g, '');
            cleanString = cleanString.replace(/\`\`\`/g, '');
        } else if (cleanString.startsWith('\`\`\`')) {
            cleanString = cleanString.replace(/\`\`\`/g, '');
        }
        return cleanString.trim();
    }
}
