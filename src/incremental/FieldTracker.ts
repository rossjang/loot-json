/**
 * 💎 loot-json FieldTracker
 * Tracks field completion status during incremental parsing
 */

export class FieldTracker {
  private trackedFields: Set<string>;
  private completedFields: Map<string, unknown> = new Map();

  constructor(fields: string[] = []) {
    this.trackedFields = new Set(fields);
  }

  /**
   * Check if a field should be tracked
   */
  isTracking(field: string): boolean {
    // If no fields specified, track all
    if (this.trackedFields.size === 0) return true;
    return this.trackedFields.has(field);
  }

  /**
   * Mark a field as complete with its value
   */
  completeField(field: string, value: unknown): void {
    if (!this.completedFields.has(field)) {
      this.completedFields.set(field, value);
    }
  }

  /**
   * Check if a field is complete
   */
  isComplete(field: string): boolean {
    return this.completedFields.has(field);
  }

  /**
   * Get the value of a completed field
   */
  getField(field: string): unknown | undefined {
    return this.completedFields.get(field);
  }

  /**
   * Get all completed fields as an object
   */
  getAllCompleted(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.completedFields) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Get list of completed field names
   */
  getCompletedFieldNames(): string[] {
    return Array.from(this.completedFields.keys());
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.completedFields.clear();
  }
}
