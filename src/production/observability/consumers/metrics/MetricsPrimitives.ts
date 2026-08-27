/**
 * MetricsPrimitives.ts
 *
 * Implements standard Observability metric types.
 */

export class Counter {
  private value = 0;
  public inc(amount = 1) { this.value += amount; }
  public get() { return this.value; }
}

export class Gauge {
  private value = 0;
  public set(val: number) { this.value = val; }
  public inc(amount = 1) { this.value += amount; }
  public dec(amount = 1) { this.value -= amount; }
  public get() { return this.value; }
}

export class Histogram {
  private values: number[] = [];
  public observe(val: number) { this.values.push(val); }
  public get() { return this.values; }
  public avg() {
    if (this.values.length === 0) return 0;
    const sum = this.values.reduce((a, b) => a + b, 0);
    return sum / this.values.length;
  }
}

export class Timer {
  private starts = new Map<string, number>();
  private histogram = new Histogram();
  
  public start(id: string) {
    this.starts.set(id, Date.now());
  }
  
  public stop(id: string) {
    const start = this.starts.get(id);
    if (start) {
      const duration = Date.now() - start;
      this.histogram.observe(duration);
      this.starts.delete(id);
      return duration;
    }
    return 0;
  }
  
  public getHistogram() {
    return this.histogram;
  }
}
