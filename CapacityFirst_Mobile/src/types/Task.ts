export interface Task {
    id: string;
    title: string;
    isCompleted: boolean;
    createdAt: string; // ISO String
    scheduledDate?: string; // YYYY-MM-DD
    estimatedTime?: number; // Minutes
}
