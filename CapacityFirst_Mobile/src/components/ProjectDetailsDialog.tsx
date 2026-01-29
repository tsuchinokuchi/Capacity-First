import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Dialog, Portal, Text, IconButton, Button, FAB, useTheme, Checkbox, List, Divider } from 'react-native-paper';
import { Project, Task } from '../types/Task';
import { useTaskStore } from '../store/useTaskStore';
import { AppTheme } from '../theme/theme';
import TaskFormDialog from './TaskFormDialog';
import { formatDate } from '../utils/DateUtils';

interface ProjectDetailsDialogProps {
    visible: boolean;
    onDismiss: () => void;
    project: Project;
}

export default function ProjectDetailsDialog({ visible, onDismiss, project }: ProjectDetailsDialogProps) {
    const theme = useTheme<AppTheme>();
    const { tasks, updateTask, deleteTask, toggleTask } = useTaskStore();

    const [taskFormVisible, setTaskFormVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Get tasks for this project, sorted by projectStepOrder
    const projectTasks = useMemo(() => {
        return tasks.filter(t => t.projectId === project.id)
            .sort((a, b) => (a.projectStepOrder || 0) - (b.projectStepOrder || 0));
    }, [tasks, project.id]);

    const handleAddTask = () => {
        setEditingTask(null);
        setTaskFormVisible(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setTaskFormVisible(true);
    };

    const handleTaskSubmit = (title: string, date?: Date, estimatedTime?: number, repeatRule?: 'daily' | 'weekly', repeatConfig?: any, notes?: string, tags?: string[], subtasks?: any[], projectId?: string) => {
        const { addTask, updateTask } = useTaskStore.getState();

        if (editingTask) {
            updateTask(editingTask.id, {
                title,
                scheduledDate: date ? date.toISOString().split('T')[0] : undefined,
                estimatedTime,
                notes,
                tags,
                subtasks,
                projectId // Ensure projectId stays or updates
            });
        } else {
            // Calculate next step order
            const maxOrder = projectTasks.reduce((max, t) => Math.max(max, t.projectStepOrder || 0), 0);
            addTask(title, date ? date.toISOString().split('T')[0] : undefined, estimatedTime, repeatRule, repeatConfig, notes, tags, subtasks, project.id, maxOrder + 1);
        }
        setTaskFormVisible(false);
    };

    const moveTask = (task: Task, direction: 'up' | 'down') => {
        const currentIndex = projectTasks.findIndex(t => t.id === task.id);
        if (currentIndex === -1) return;

        if (direction === 'up' && currentIndex > 0) {
            const prevTask = projectTasks[currentIndex - 1];
            // Swap orders
            const orderA = task.projectStepOrder || 0;
            const orderB = prevTask.projectStepOrder || 0;

            // If they have same order (shouldn't happen but...), adjust
            // Ideally we want to just swap their positions in the list logic.
            // Let's swap their order values. If values are same, decrement one.
            updateTask(task.id, { projectStepOrder: orderB });
            updateTask(prevTask.id, { projectStepOrder: orderA });

        } else if (direction === 'down' && currentIndex < projectTasks.length - 1) {
            const nextTask = projectTasks[currentIndex + 1];
            const orderA = task.projectStepOrder || 0;
            const orderB = nextTask.projectStepOrder || 0;

            updateTask(task.id, { projectStepOrder: orderB });
            updateTask(nextTask.id, { projectStepOrder: orderA });
        }
    };

    const normalizeOrders = () => {
        // Renumber all tasks 1..N
        projectTasks.forEach((t, index) => {
            if (t.projectStepOrder !== index + 1) {
                updateTask(t.id, { projectStepOrder: index + 1 });
            }
        });
    };

    // Auto-normalize on load if orders are messy? (Maybe later)

    const renderTaskItem = ({ item, index }: { item: Task, index: number }) => (
        <View style={styles.taskItem}>
            <View style={styles.taskLeft}>
                <Checkbox
                    status={item.isCompleted ? 'checked' : 'unchecked'}
                    onPress={() => toggleTask(item.id)}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                        variant="bodyLarge"
                        style={[
                            item.isCompleted && { textDecorationLine: 'line-through', color: theme.colors.outline }
                        ]}
                        onPress={() => handleEditTask(item)}
                    >
                        {item.title}
                    </Text>
                    {item.scheduledDate && (
                        <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                            {item.scheduledDate}
                        </Text>
                    )}
                </View>
            </View>
            <View style={styles.taskActions}>
                <IconButton
                    icon="arrow-up"
                    size={20}
                    disabled={index === 0}
                    onPress={() => moveTask(item, 'up')}
                />
                <IconButton
                    icon="arrow-down"
                    size={20}
                    disabled={index === projectTasks.length - 1}
                    onPress={() => moveTask(item, 'down')}
                />
            </View>
        </View>
    );

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
                <Dialog.Title style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton icon="folder" iconColor={project.color} size={24} style={{ margin: 0, marginRight: 8 }} />
                    {project.title}
                </Dialog.Title>
                <Dialog.Content style={styles.content}>
                    <Text variant="bodyMedium" style={{ marginBottom: 16 }}>{project.description || "No description"}</Text>

                    <View style={styles.taskListHeader}>
                        <Text variant="titleMedium">Steps ({projectTasks.length})</Text>
                        <Button mode="text" compact onPress={normalizeOrders}>Normalize Order</Button>
                    </View>
                    <Divider />

                    <FlatList
                        data={projectTasks}
                        renderItem={renderTaskItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        style={{ maxHeight: 400 }}
                    />

                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Close</Button>
                </Dialog.Actions>

                {/* FAB inside Dialog? Might be tricky with positioning. 
                    Better to put it in content or just a button in actions? 
                    Or use a Portal for FAB? 
                    Dialog content is restricted. Let's add a button in the task list header or actions.
                */}
            </Dialog>

            {/* Using a separate Portal for FAB to ensure it floats above Dialog? 
                Actually, standard FAB might be hidden by Dialog overlay.
                Let's put an 'Add Step' button in the Dialog Actions or a clear button in the content.
            */}
            {visible && (
                <FAB
                    icon="plus"
                    label="Add Step"
                    style={styles.fab}
                    onPress={handleAddTask}
                />
            )}

            <TaskFormDialog
                visible={taskFormVisible}
                onDismiss={() => setTaskFormVisible(false)}
                onSubmit={handleTaskSubmit}
                initialTitle={editingTask?.title}
                initialDate={editingTask?.scheduledDate ? new Date(editingTask.scheduledDate) : undefined}
                initialEstimatedTime={editingTask?.estimatedTime}
                initialNotes={editingTask?.notes}
                initialTags={editingTask?.tags}
                initialSubtasks={editingTask?.subtasks}
                title={editingTask ? "Edit Step" : "Add Step"}
                submitLabel={editingTask ? "Update" : "Add"}
                taskId={editingTask?.id}
                initialProjectId={project.id} // Lock project ID
            />
        </Portal>
    );
}

const styles = StyleSheet.create({
    dialog: {
        maxHeight: '90%',
    },
    content: {
        // height: 500, // Fixed height or flex
    },
    taskListHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    taskLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskActions: {
        flexDirection: 'row',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        // Note: FAB z-index might struggle with Dialog Modal. 
        // If FAB is outside Dialog definition but inside Portal...
        // Dialog usually has high elevation.
    }
});
