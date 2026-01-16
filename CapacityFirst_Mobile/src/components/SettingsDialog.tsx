import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Dialog, Portal, Button, Text, TextInput, Divider } from 'react-native-paper';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTaskStore } from '../store/useTaskStore';

interface SettingsDialogProps {
    visible: boolean;
    onDismiss: () => void;
}

export default function SettingsDialog({ visible, onDismiss }: SettingsDialogProps) {
    const { dailyCapacityMinutes, setDailyCapacity } = useSettingsStore();
    const { tasks, deleteTask } = useTaskStore(); // We might need a 'clearAll' action, but for now we'll rely on store updates or add one.
    // Actually, useTaskStore definitions viewed earlier didn't have clearAll. I'll stick to what I have or request a clearAll.
    // Wait, I can't easily clear all without an action or iterating.
    // Let's add a quick client-side clear for now by iterating (slow but fine for MVP) or just leave it.
    // Better: I will implement a "Delete All Data" by clearing AsyncStorage or iterating. 
    // Let's iterate tasks for now as it's safer than raw storage clear.

    const [capacityInput, setCapacityInput] = useState('');

    useEffect(() => {
        if (visible) {
            const h = Math.floor(dailyCapacityMinutes / 60);
            const m = dailyCapacityMinutes % 60;
            // Simple representation for editing? Maybe just total minutes or hours?
            // User asked for "Daily Capacity Setting". Let's provide an input for hours.
            setCapacityInput((dailyCapacityMinutes / 60).toString());
        }
    }, [visible, dailyCapacityMinutes]);

    const handleSave = () => {
        const hours = parseFloat(capacityInput);
        if (!isNaN(hours) && hours > 0) {
            setDailyCapacity(Math.floor(hours * 60));
        }
        onDismiss();
    };

    const handleClearData = () => {
        Alert.alert(
            "Delete All Data",
            "Are you sure you want to delete ALL tasks? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        useTaskStore.getState().clearAllTasks();
                        onDismiss();
                        Alert.alert("Success", "All tasks have been deleted.");
                    }
                }
            ]
        );
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>Settings</Dialog.Title>
                <Dialog.Content>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Daily Capacity</Text>
                    <View style={styles.row}>
                        <TextInput
                            mode="outlined"
                            label="Hours"
                            value={capacityInput}
                            onChangeText={setCapacityInput}
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                        />
                        <Text style={{ marginLeft: 8, alignSelf: 'center' }}>hours / day</Text>
                    </View>
                    <Text variant="bodySmall" style={styles.hint}>
                        Default target for your daily planning.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="titleMedium" style={styles.sectionTitle}>App Info</Text>
                    <Text>Version: 0.2.0 (Beta)</Text>

                    <Divider style={styles.divider} />

                    <Button
                        mode="contained"
                        buttonColor="#B00020"
                        onPress={handleClearData}
                        style={styles.dangerButton}
                    >
                        Delete All Data
                    </Button>

                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>Cancel</Button>
                    <Button onPress={handleSave}>Save</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        marginTop: 8,
        marginBottom: 8,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hint: {
        color: '#666',
        marginTop: 4,
    },
    divider: {
        marginVertical: 16,
    },
    dangerButton: {
        marginTop: 8,
    }
});
