export class CircuitBreaker {
    private failureCount = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    private lastFailureTime: number | null = null;
    
    constructor(private failureThreshold: number = 3, private resetTimeoutMs: number = 30000) {}

    public async execute<T>(action: () => Promise<T>): Promise<T> {
        this.checkState();

        if (this.state === 'OPEN') {
            throw new Error('CircuitBreaker is OPEN. Request blocked.');
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private checkState() {
        if (this.state === 'OPEN' && this.lastFailureTime) {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
            }
        }
    }

    private onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    private onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            console.warn('[CircuitBreaker] State transition to OPEN!');
        }
    }
}
