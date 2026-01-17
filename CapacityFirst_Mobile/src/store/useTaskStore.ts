import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/Task';

// Simple ID generator to avoid external dependencies
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

interface TaskState {
    tasks: Task[];
    addTask: (title: string, scheduledDate?: string, estimatedTime?: number) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
    toggleTask: (id: string) => void;
    deleteTask: (id: string) => void;
    clearAllTasks: () => void;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set) => ({
            tasks: [],
            addTask: (title, scheduledDate, estimatedTime) =>
                set((state) => ({
                    tasks: [
                        ...state.tasks,
                        {
                            id: generateId(),
                            title,
                            isCompleted: false,
                            createdAt: new Date().toISOString(),
                            scheduledDate,
                            estimatedTime,
                        },
                    ],
                })),
            updateTask: (id, updates) =>
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? { ...task, ...updates } : task
                    ),
                })),
            toggleTask: (id) =>
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
                    ),
                })),
            deleteTask: (id) =>
                set((state) => ({
                    tasks: state.tasks.filter((task) => task.id !== id),
                })),
            clearAllTasks: () => set({ tasks: [] }),
        }),
        {
            name: 'task-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
