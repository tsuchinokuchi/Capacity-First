import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Checkbox, Card, IconButton } from 'react-native-paper';
import { useTaskStore } from '../store/useTaskStore';
import { Task } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import SettingsDialog from '../components/SettingsDialog';
import { getWeekDates, toISODateString, formatDate, isSameDay } from '../utils/DateUtils';

export default function WeeklyScreen() {
    const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const weekDates = getWeekDates(new Date());

    const openAddDialog = (date: Date) => {
        setSelectedDate(date);
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

    const renderTask = (task: Task) => (
        <View key={task.id} style={styles.taskRow}>
            <Checkbox
                status={task.isCompleted ? 'checked' : 'unchecked'}
                onPress={() => toggleTask(task.id)}
            />
            <View style={styles.taskTextContainer}>
                <Text
                    style={[
                        styles.taskTitle,
                        task.isCompleted && styles.completedTask,
                    ]}
                    onPress={() => openEditDialog(task)}
                >
                    {task.title}
                </Text>
                {task.estimatedTime && (
                    <Text style={styles.timeBadgeSmall}>
                        {task.estimatedTime}m
                    </Text>
                )}
            </View>
            <IconButton
                icon="trash-can-outline"
                size={16}
                onPress={() => {
                    Alert.alert(
                        "Delete Task",
                        "Are you sure you want to delete this task?",
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Delete", style: "destructive", onPress: () => deleteTask(task.id) }
                        ]
                    );
                }}
            />
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text variant="headlineSmall" style={styles.header}>Weekly Overview</Text>
                <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {weekDates.map((date, index) => {
                    // Filter tasks for this specific date
                    const dateStr = toISODateString(date);
                    const dayTasks = tasks.filter(t => t.scheduledDate === dateStr);
                    const isToday = isSameDay(date, new Date());

                    return (
                        <Card key={index} style={[styles.dayCard, isToday && styles.todayCard]}>
                            <Card.Content>
                                <View style={styles.cardHeader}>
                                    <Text variant="titleMedium" style={isToday ? styles.todayText : undefined}>
                                        {formatDate(date)}
                                    </Text>
                                    <IconButton
                                        icon="plus"
                                        size={20}
                                        onPress={() => openAddDialog(date)}
                                    />
                                </View>

                                {dayTasks.length > 0 ? (
                                    dayTasks.map(renderTask)
                                ) : (
                                    <Text style={styles.noTasksText}>No tasks</Text>
                                )}
                            </Card.Content>
                        </Card>
                    );
                })}
            </ScrollView>

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                // Use selectedDate for adding, or task date for editing
                initialDate={editingTask ? (editingTask.scheduledDate ? new Date(editingTask.scheduledDate) : undefined) : selectedDate}
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
        backgroundColor: '#f5f5f5',
        paddingTop: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 16,
    },
    header: {
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    dayCard: {
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    todayCard: {
        borderColor: '#6200ee',
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 4,
    },
    todayText: {
        color: '#6200ee',
        fontWeight: 'bold',
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    taskTitle: {
        flex: 1,
        fontSize: 14,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    noTasksText: {
        color: '#ccc',
        fontStyle: 'italic',
        fontSize: 12,
    },
    taskTextContainer: {
        flex: 1,
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    timeBadgeSmall: {
        backgroundColor: '#e0e0e0',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        fontSize: 10,
        color: '#333',
        marginLeft: 4,
    },
});
