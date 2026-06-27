import { IHistoryManager } from './interfaces';
import { ConversationLog } from './models';

export class HistoryManager implements IHistoryManager {
    private logs: ConversationLog[] = [];

    async log(entry: ConversationLog): Promise<void> {
        console.log(`[HistoryManager] Logging interaction: ${entry.id}`);
        this.logs.push(entry);
    }

    async getHistory(): Promise<ReadonlyArray<ConversationLog>> {
        return this.logs;
    }
}
