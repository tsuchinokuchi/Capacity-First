import React, { useState } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text, Checkbox, Card, IconButton, FAB } from 'react-native-paper';
import { useTaskStore } from '../store/useTaskStore';
import { Task } from '../types/Task';
import TaskFormDialog from '../components/TaskFormDialog';
import SettingsDialog from '../components/SettingsDialog';
import { toISODateString } from '../utils/DateUtils';

export default function PoolScreen() {
    const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTaskStore();

    // Dialog State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Filter for Pool (no scheduledDate)
    const poolTasks = tasks.filter(t => !t.scheduledDate);

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
                <View style={styles.taskTextWrapper}>
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
                        <Text style={styles.timeBadge}>
                            {item.estimatedTime}m
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
                <Text variant="headlineMedium" style={styles.header}>Pool (Someday)</Text>
                <IconButton icon="cog" size={24} onPress={() => setSettingsVisible(true)} />
            </View>

            <FlatList
                data={poolTasks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No tasks in the pool. {'\n'}Everything is scheduled!</Text>
                }
            />

            <FAB
                icon="plus"
                style={styles.fab}
                onPress={openAddDialog}
                color="white"
                theme={{ colors: { accent: '#03dac6' } }}
            />

            <TaskFormDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                onSubmit={handleSubmit}
                initialTitle={editingTask?.title || ''}
                initialDate={editingTask ? undefined : undefined}
                initialEstimatedTime={editingTask?.estimatedTime}
                title={editingTask ? "Edit Task" : "Add to Pool"}
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
        backgroundColor: '#F0F8FF', // Light Blue intent
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
    taskTitle: {
        flex: 1,
        marginLeft: 8,
    },
    completedTask: {
        textDecorationLine: 'line-through',
        color: '#888',
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
        backgroundColor: '#018786', // Teal darken
    },
});
