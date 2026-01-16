import React, { useState } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text, Checkbox, Card, IconButton, FAB } from 'react-native-paper';
import { useTaskStore } from '../store/useTaskStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Task } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import SettingsDialog from '../components/SettingsDialog';
import { toISODateString } from '../utils/DateUtils';

export default function DailyScreen() {
    const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();
    const { dailyCapacityMinutes } = useSettingsStore();

    // Dialog State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Filter for Today
    const todayStr = toISODateString(new Date());
    const todayTasks = tasks.filter(t => t.scheduledDate === todayStr);

    // Calculate Total Estimated Time
    const totalMinutes = todayTasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    };

    const capacityHours = Math.floor(dailyCapacityMinutes / 60);
    // Display string: e.g. "Total: 4h 30m / 8h"
    const totalTimeStr = `${formatTime(totalMinutes)} / ${capacityHours}h`;
    const isOverCapacity = totalMinutes > dailyCapacityMinutes;

    const openAddDialog = () => {
        setEditingTask(null);
        setDialogVisible(true);
    };

    const openEditDialog = (task: Task) => {
        setEditingTask(task);
        setDialogVisible(true);
    };

    const handleSubmit = (title: string, date?: Date, estimatedTime?: number) => {
        if (editingTask) {
            updateTask(editingTask.id, {
                title,
                scheduledDate: date ? toISODateString(date) : undefined,
                estimatedTime
            });
        } else {
            addTask(title, date ? toISODateString(date) : undefined, estimatedTime);
        }
    };

    const renderItem = ({ item }: { item: Task }) => (
        <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
                <Checkbox
                    status={item.isCompleted ? 'checked' : 'unchecked'}
                    onPress={() => toggleTask(item.id)}
                />
                <View style={styles.taskTextContainer}>
                    <Text
                        variant="bodyLarge"
                        style={[
                            styles.taskTitle,
                            item.isCompleted && styles.completedTask,
                        ]}
                        onPress={() => openEditDialog(item)}
                    >
                        {item.title}
                    </Text>
                    {item.estimatedTime && (
                        <Text variant="bodySmall" style={styles.timeBadge}>
                            {item.estimatedTime >= 60 ? `${Math.floor(item.estimatedTime / 60)}h ${item.estimatedTime % 60}m` : `${item.estimatedTime}m`}
                        </Text>
                    )}
                </View>
                <IconButton
                    icon="trash-can-outline"
                    size={20}
                    onPress={() => deleteTask(item.id)}
                />
            </Card.Content>
        </Card>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text variant="headlineMedium" style={styles.header}>Daily Tasks</Text>
                <View style={styles.headerRight}>
                    <Text variant="titleMedium" style={[styles.totalTime, isOverCapacity && styles.overCapacity]}>
                        {totalTimeStr}
                    </Text>
                    <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
                </View>
            </View>

            <FlatList
                data={todayTasks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No tasks for today. {'\n'}Relax or add a new one!</Text>
                }
            />

            <FAB
                icon="plus"
                style={styles.fab}
                onPress={openAddDialog}
            />

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                initialDate={editingTask ? (editingTask.scheduledDate ? new Date(editingTask.scheduledDate) : undefined) : new Date()}
                initialEstimatedTime={editingTask?.estimatedTime}
                title={editingTask ? "Edit Task" : "Add Task"}
                submitLabel={editingTask ? "Update" : "Add"}
            />

            <SettingsDialog
                visible={settingsVisible}
                onDismiss={() => setSettingsVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    header: {
        fontWeight: 'bold',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    totalTime: {
        color: '#6200ee',
        fontWeight: 'bold',
        marginRight: 8,
    },
    overCapacity: {
        color: '#B00020', // Error color
    },
    listContent: {
        paddingBottom: 80,
    },
    card: {
        marginBottom: 8,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskTextContainer: {
        flex: 1,
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    taskTitle: {
        marginRight: 8,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    timeBadge: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        color: '#333',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 32,
        color: '#888',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#6200ee',
    },
});
