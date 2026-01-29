import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, RepeatConfig, Subtask, Project } from '../types/Task';

// Simple ID generator to avoid external dependencies
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

interface TaskState {
    tasks: Task[];
    addTask: (title: string, scheduledDate?: string, estimatedTime?: number, repeatRule?: 'daily' | 'weekly', repeatConfig?: RepeatConfig, notes?: string, tags?: string[], subtasks?: Subtask[], projectId?: string, projectStepOrder?: number) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
    updateTasks: (ids: string[], updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
    toggleTask: (id: string) => void;
    toggleSubtask: (taskId: string, subtaskId: string) => void;
    deleteTask: (id: string) => void;
    clearAllTasks: () => void;
    replenishTasks: () => void;

    stopRecurrence: (signature: string) => void;

    // Project Actions
    projects: Project[];
    addProject: (project: Partial<Project>, fromTemplateId?: string) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    deleteProject: (id: string) => void;
}

export const getTaskSignature = (task: Task): string | null => {
    if (!task.repeatRule && !task.repeatConfig) return null;
    let configStr = '';
    if (task.repeatConfig) {
        configStr = JSON.stringify(task.repeatConfig);
    } else if (task.repeatRule) {
        configStr = task.repeatRule;
    }
    return `${task.title}|${configStr}`;
};

export const useTaskStore = create<TaskState>()(
    persist(
        (set) => ({
            tasks: [],
            projects: [],
            addTask: (title, scheduledDate, estimatedTime, repeatRule, repeatConfig, notes, tags, subtasks, projectId, projectStepOrder) =>
                set((state) => {
                    const newTasks: Task[] = [];
                    const baseDate = scheduledDate ? new Date(scheduledDate) : new Date();

                    // Normalize config
                    let config: RepeatConfig | undefined = repeatConfig;
                    if (!config && repeatRule && scheduledDate) {
                        // Convert legacy/simple rule to config
                        if (repeatRule === 'daily') {
                            config = { frequency: 'daily', interval: 1 };
                        } else if (repeatRule === 'weekly') {
                            const day = new Date(scheduledDate).getDay();
                            config = { frequency: 'weekly', interval: 1, daysOfWeek: [day] };
                        }
                    }

                    // Helper function to format date
                    const formatDateStr = (d: Date) => {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${dd}`;
                    };

                    const createSingleTask = (dateStr?: string): Task => ({
                        id: generateId(),
                        title,
                        isCompleted: false,
                        createdAt: new Date().toISOString(),
                        scheduledDate: dateStr,
                        estimatedTime,
                        repeatRule,
                        repeatConfig,
                        notes,
                        tags,

                        subtasks,
                        projectId,
                        projectStepOrder
                    });

                    if (config && scheduledDate) {
                        // RECURRING LOGIC: Generate for next 30 days
                        // Keep generating until we cover about 30 days range
                        const limitRangeDays = 31; // Cover a month
                        const startDate = new Date(baseDate);

                        // We iterate day by day to check if it matches the rule
                        for (let i = 0; i < limitRangeDays; i++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(startDate.getDate() + i);

                            let shouldAdd = false;

                            if (config.frequency === 'daily') {
                                // Check interval (every N days)
                                if (i % config.interval === 0) {
                                    shouldAdd = true;
                                }
                            } else if (config.frequency === 'weekly') {
                                // Check interval (every N weeks)
                                // Calculate week difference
                                const dayDiff = Math.floor(i / 7);
                                // Caution: simple division works if we start from the base date.
                                // If today is Monday and we want every 2 weeks, current week (diff=0) matches.

                                if (dayDiff % config.interval === 0) {
                                    // Check Days of Week
                                    const day = currentDate.getDay();
                                    if (config.daysOfWeek && config.daysOfWeek.includes(day)) {
                                        shouldAdd = true;
                                    }
                                }
                            }

                            if (shouldAdd) {
                                newTasks.push(createSingleTask(formatDateStr(currentDate)));
                            }
                        }
                    } else {
                        // SINGLE TASK
                        newTasks.push(createSingleTask(scheduledDate));
                    }

                    return {
                        tasks: [...state.tasks, ...newTasks],
                    };
                }),
            updateTask: (id, updates) =>
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? { ...task, ...updates } : task
                    ),
                })),
            updateTasks: (ids, updates) =>
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        ids.includes(task.id) ? { ...task, ...updates } : task
                    ),
                })),
            toggleTask: (id) =>
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
                    ),
                })),
            toggleSubtask: (taskId, subtaskId) =>
                set((state) => ({
                    tasks: state.tasks.map((task) => {
                        if (task.id !== taskId || !task.subtasks) return task;
                        return {
                            ...task,
                            subtasks: task.subtasks.map(s =>
                                s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
                            )
                        };
                    }),
                })),
            deleteTask: (id) =>
                set((state) => ({
                    tasks: state.tasks.filter((task) => task.id !== id),
                })),
            clearAllTasks: () => set({ tasks: [] }),
            replenishTasks: () => set((state) => {
                const horizonDays = 30; // Generate up to 30 days ahead
                const today = new Date();
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + horizonDays);
                targetDate.setHours(23, 59, 59, 999); // End of target day

                // 1. Group tasks by signature (Title + Config) to identify series
                const groups: { [key: string]: Task[] } = {};

                state.tasks.forEach(task => {
                    // Only consider tasks with repeat logic
                    if (!task.repeatRule && !task.repeatConfig) return;

                    // Normalize config for signature
                    let configStr = '';
                    if (task.repeatConfig) {
                        configStr = JSON.stringify(task.repeatConfig);
                    } else if (task.repeatRule) {
                        configStr = task.repeatRule;
                    }

                    const signature = `${task.title}|${configStr}`;
                    if (!groups[signature]) {
                        groups[signature] = [];
                    }
                    groups[signature].push(task);
                });

                const newTasks: Task[] = [];
                const generateIdLocal = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

                // Helper to generate a task instance
                const createInstance = (template: Task, dateStr: string): Task => ({
                    ...template,
                    id: generateIdLocal(),
                    scheduledDate: dateStr,
                    isCompleted: false,
                    createdAt: new Date().toISOString(),
                    // We keep the repeat config so it stays part of the series
                });

                // 2. Process each group
                Object.values(groups).forEach(groupTasks => {
                    const template = groupTasks[0]; // Use first as template (assuming consistent)

                    // Find the latest scheduled date in this group
                    let maxDateStr = '';
                    // Also find min date to calculate phase for weekly intervals if needed
                    // For now, we assume standard intervals logic relative to any valid date

                    groupTasks.forEach(t => {
                        if (t.scheduledDate && t.scheduledDate > maxDateStr) {
                            maxDateStr = t.scheduledDate;
                        }
                    });

                    if (!maxDateStr) return; // Should has scheduledDate

                    const lastDate = new Date(maxDateStr);

                    // If last date is already covered (>= targetDate), skip
                    if (lastDate >= targetDate) return;

                    // Generate from lastDate + 1 day
                    const nextDate = new Date(lastDate);
                    nextDate.setDate(nextDate.getDate() + 1);

                    // Re-derive config object used in loop
                    let config: RepeatConfig | undefined = template.repeatConfig;
                    if (!config && template.repeatRule) {
                        if (template.repeatRule === 'daily') {
                            config = { frequency: 'daily', interval: 1 };
                        } else if (template.repeatRule === 'weekly') {
                            // We need a base date to determine day of week if not simple
                            // But for weekly generic, we can just check daysOfWeek or interval
                            // If simple 'weekly', assume same day of week as template
                            const day = new Date(template.scheduledDate!).getDay();
                            config = { frequency: 'weekly', interval: 1, daysOfWeek: [day] };
                        }
                    }

                    if (!config) return;

                    // 3. Loop from nextDate to targetDate
                    const currentScan = new Date(nextDate);
                    while (currentScan <= targetDate) {
                        let shouldAdd = false;

                        if (config.frequency === 'daily') {
                            // Logic: Difference in days from reference? 
                            // If interval is 1, always true.
                            // If interval > 1, we need reference. 
                            // We use 'lastDate' as reference? No, lastDate might be just one instance.
                            // We need consistent reference. 'template.scheduledDate' is safer.
                            // But simplify: assume interval 1 for daily usually. 
                            // If interval > 1, calculate diff from template.scheduledDate
                            const refDate = new Date(template.scheduledDate!);
                            const diffTime = currentScan.getTime() - refDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays % config.interval === 0) shouldAdd = true;

                        } else if (config.frequency === 'weekly') {
                            const refDate = new Date(template.scheduledDate!);
                            // Check Day of Week
                            const day = currentScan.getDay();
                            const targetDays = config.daysOfWeek || [refDate.getDay()];

                            if (targetDays.includes(day)) {
                                // Check Interval (Weeks)
                                // Calculate week diff from reference
                                // A simple way: diff in days / 7
                                const diffTime = currentScan.getTime() - refDate.getTime();
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                const diffWeeks = Math.floor(diffDays / 7);

                                // If diffDays % 7 is 0 (same DOW), then diffWeeks is exact.
                                // If we rely on same DOW match first.
                                if (diffWeeks % config.interval === 0) {
                                    shouldAdd = true;
                                }
                            }
                        }

                        if (shouldAdd) {
                            const dStr = currentScan.toISOString().split('T')[0];
                            newTasks.push(createInstance(template, dStr));
                        }

                        currentScan.setDate(currentScan.getDate() + 1);
                    }
                });

                if (newTasks.length === 0) return state;

                // Log for debugging (in real app, maybe toast)
                console.log(`Replenished ${newTasks.length} tasks.`);

                return {
                    tasks: [...state.tasks, ...newTasks]
                };
            }),
            stopRecurrence: (signature) => set((state) => ({
                tasks: state.tasks.map(t => {
                    const sig = getTaskSignature(t);
                    if (sig === signature) {
                        // Remove repeat settings
                        const { repeatRule, repeatConfig, ...rest } = t;
                        return rest;
                    }
                    return t;
                })
            })),

            // Project Implementation
            addProject: (projectData, fromTemplateId) => set((state) => {
                const newProject: Project = {
                    id: generateId(),
                    title: projectData.title || 'New Project',
                    description: projectData.description,
                    color: projectData.color,
                    status: projectData.status || 'active',
                    createdAt: new Date().toISOString(),
                };

                let additionalTasks: Task[] = [];

                // Copy tasks from template
                if (fromTemplateId && fromTemplateId !== '') {
                    // Find tasks belonging to the template project
                    const templateTasks = state.tasks.filter(t => t.projectId === fromTemplateId);

                    if (templateTasks.length > 0) {
                        additionalTasks = templateTasks.map(t => ({
                            ...t,
                            id: generateId(),
                            projectId: newProject.id, // Link to new project
                            scheduledDate: undefined, // Reset date? Or keep relative? Reset for now.
                            isCompleted: false,
                            createdAt: new Date().toISOString(),
                        }));
                    }
                }

                return {
                    projects: [...state.projects, newProject],
                    tasks: [...state.tasks, ...additionalTasks]
                };
            }),

            updateProject: (id, updates) => set((state) => ({
                projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
            })),

            deleteProject: (id) => set((state) => ({
                projects: state.projects.filter(p => p.id !== id),
                // Unlink tasks instead of deleting them
                tasks: state.tasks.map(t => t.projectId === id ? { ...t, projectId: undefined } : t)
            })),
        }),
        {
            name: 'task-storage-v2', // Changed key to force reset
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
