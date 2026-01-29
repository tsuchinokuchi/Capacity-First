export interface Subtask {
    id: string;
    title: string;
    isCompleted: boolean;
}

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
    subtasks?: Subtask[];
    projectId?: string;
    projectStepOrder?: number;
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

export interface Project {
    id: string;
    title: string;
    description?: string;
    color?: string;
    status: 'active' | 'archived' | 'template';
    createdAt: string;
    // For templates, we might want to store step definitions here or just use linked tasks.
    // simpler to keep tasks in the main pool but marked as template tasks?
    // OR: for templates, store a simple list of step titles/estimates?
    // Let's go with keeping "template tasks" in the main task list but filtered out, 
    // OR simpler: Project has `templateSteps?: string[]` (just titles) for v1?
    // Valid plan: "Templates" are just Projects with status='template'. 
    // Their structured tasks are normal Tasks but with projectId pointing to the template project.
}
