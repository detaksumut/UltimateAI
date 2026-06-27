import { ConversationLog } from './models';

export interface IHistoryManager {
    log(entry: ConversationLog): Promise<void>;
}
