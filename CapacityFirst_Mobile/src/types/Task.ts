export interface Task {
    id: string;
    title: string;
    isCompleted: boolean;
    createdAt: string; // ISO String
    scheduledDate?: string; // YYYY-MM-DD
    estimatedTime?: number; // Minutes
    repeatRule?: 'daily' | 'weekly'; // Legacy simple rule
    repeatConfig?: RepeatConfig; // Advanced recurrence rule
    notes?: string;
    tags?: string[]; // Array of Tag IDs
}

export interface Tag {
    id: string;
    name: string;
    color: string;
}

export interface RepeatConfig {
    frequency: 'daily' | 'weekly';
    interval: number; // e.g. 1 for every week, 2 for every 2 weeks
    daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat. Required if frequency is weekly.
    endDate?: string; // Optional end date
}
