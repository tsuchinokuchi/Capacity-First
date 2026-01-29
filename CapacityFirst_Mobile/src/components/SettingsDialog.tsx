import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Portal, Button, Text, TextInput, Divider, useTheme, Chip, IconButton, Switch, List, Checkbox } from 'react-native-paper';
import { StyleSheet, View, Alert, ScrollView, TouchableOpacity, TextInput as NativeTextInput } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTaskStore, getTaskSignature } from '../store/useTaskStore';
import { AppTheme } from '../theme/theme';
import { Task } from '../types/Task';

interface SettingsDialogProps {
    visible: boolean;
    onDismiss: () => void;
}

export default function SettingsDialog({ visible, onDismiss }: SettingsDialogProps) {
    const theme = useTheme<AppTheme>();
    const {
        dailyCapacityMinutes, tags, setDailyCapacity, addTag, deleteTag, sortConfigs, updateSortConfig, moveTagPriority
    } = useSettingsStore();
    const { tasks, deleteTask, stopRecurrence, projects, addProject, deleteProject } = useTaskStore();

    // Navigation State
    const [currentSection, setCurrentSection] = useState<'main' | 'general' | 'tags' | 'sorting' | 'recurring' | 'templates'>('main');

    // Ensure safe default if store is not populated
    const safeSortConfigs = sortConfigs || [];

    const [capacityInput, setCapacityInput] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const inputRef = useRef<any>(null);
    const [selectedColor, setSelectedColor] = useState('#6200ee');
    const [newTemplateTitle, setNewTemplateTitle] = useState('');

    const PRESET_COLORS = ['#6200ee', '#03dac6', '#b00020', '#ff9800', '#2196f3', '#4caf50', '#9c27b0'];

    const templates = projects.filter(p => p.status === 'template');

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

    const handleAddTag = () => {
        if (newTagName.trim()) {
            addTag(newTagName.trim(), selectedColor);
            setNewTagName('');
            // Clear input visually for uncontrolled component
            if (inputRef.current) {
                inputRef.current.clear();
            }
        }
    };

    const handleToggleSort = (field: string) => {
        const newConfigs = safeSortConfigs.map(config =>
            config.field === field ? { ...config, enabled: !config.enabled } : config
        );
        updateSortConfig(newConfigs);
    };

    const handleToggleSortDirection = (field: string) => {
        const newConfigs = safeSortConfigs.map(config =>
            config.field === field ? { ...config, order: (config.order === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } : config
        );
        updateSortConfig(newConfigs);
    };

    const handleSortMove = (index: number, direction: 'up' | 'down') => {
        const newConfigs = [...safeSortConfigs];
        if (direction === 'up' && index > 0) {
            [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]];
        } else if (direction === 'down' && index < newConfigs.length - 1) {
            [newConfigs[index + 1], newConfigs[index]] = [newConfigs[index], newConfigs[index + 1]];
        }
        updateSortConfig(newConfigs);
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

    const getRecurringGroups = () => {
        const groups: { [key: string]: Task[] } = {};
        tasks.forEach(task => {
            const sig = getTaskSignature(task);
            if (sig) {
                if (!groups[sig]) groups[sig] = [];
                groups[sig].push(task);
            }
        });
        return groups;
    };

    const handleStopRecurrence = (signature: string) => {
        Alert.alert(
            "Stop Recurrence",
            "This will stop auto-generating future tasks. EXISTING TASKS WILL NOT BE DELETED.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Stop",
                    style: "default",
                    onPress: () => stopRecurrence(signature)
                }
            ]
        );
    };

    const renderMainMenu = () => (
        <View>
            <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentSection('general')}>
                <IconButton icon="tune" />
                <Text variant="bodyLarge">General Settings</Text>
                <IconButton icon="chevron-right" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentSection('tags')}>
                <IconButton icon="tag-multiple" />
                <Text variant="bodyLarge">Tag Management</Text>
                <IconButton icon="chevron-right" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentSection('sorting')}>
                <IconButton icon="sort" />
                <Text variant="bodyLarge">Task Sorting</Text>
                <IconButton icon="chevron-right" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentSection('recurring')}>
                <IconButton icon="update" />
                <Text variant="bodyLarge">Recurring Rules</Text>
                <IconButton icon="chevron-right" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentSection('templates')}>
                <IconButton icon="content-copy" />
                <Text variant="bodyLarge">Template Management</Text>
                <IconButton icon="chevron-right" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity style={styles.menuItem} onPress={handleClearData}>
                <IconButton icon="delete-forever" iconColor={theme.colors.error} />
                <Text variant="bodyLarge" style={{ color: theme.colors.error }}>Delete All Data</Text>
            </TouchableOpacity>
        </View>
    );

    const renderRecurringRules = () => {
        const groups = getRecurringGroups();
        const signatures = Object.keys(groups);

        return (
            <ScrollView>
                <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                    Manage your recurring task series. Stopping a rule will prevent future auto-generation.
                </Text>
                {signatures.length === 0 ? (
                    <Text style={styles.hint}>No recurring tasks found.</Text>
                ) : (
                    signatures.map(sig => {
                        const task = groups[sig][0];
                        return (
                            <View key={sig} style={styles.recurringRow}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{task.title}</Text>
                                    <Text variant="bodySmall">
                                        {task.repeatConfig ?
                                            `${task.repeatConfig.frequency} (Interval: ${task.repeatConfig.interval})` :
                                            task.repeatRule}
                                    </Text>
                                </View>
                                <IconButton
                                    icon="stop-circle-outline"
                                    iconColor={theme.colors.error}
                                    onPress={() => handleStopRecurrence(sig)}
                                />
                            </View>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    const renderTemplates = () => (

        <View>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                Manage project templates. Use these to quickly create projects with predefined steps.
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
                {templates.map(t => (
                    <View key={t.id} style={styles.tagRow}>
                        <Text style={{ flex: 1 }}>{t.title}</Text>
                        <IconButton icon="delete" size={20} onPress={() => deleteProject(t.id)} />
                    </View>
                ))}
                {templates.length === 0 && <Text style={styles.hint}>No templates created yet.</Text>}
            </ScrollView>

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.tagInputContainer}>
                <TextInput
                    label="New Template Name"
                    value={newTemplateTitle}
                    onChangeText={setNewTemplateTitle}
                    style={{ flex: 1, marginRight: 8, height: 40, fontSize: 14 }}
                    mode="outlined"
                    dense
                />
                <IconButton
                    icon="plus"
                    mode="contained"
                    containerColor={theme.colors.primaryContainer}
                    iconColor={theme.colors.onPrimaryContainer}
                    onPress={() => {
                        if (newTemplateTitle.trim()) {
                            addProject({ title: newTemplateTitle.trim(), status: 'template' });
                            setNewTemplateTitle('');
                        }
                    }}
                />
            </View>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                * Add steps to templates later via Project details (Select 'Template' status filter).
            </Text>
        </View>
    );

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '80%' }}>
                <Dialog.Title>
                    {currentSection === 'main' ? 'Settings' :
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <IconButton icon="arrow-left" onPress={() => setCurrentSection('main')} style={{ marginLeft: -8 }} />
                            <Text variant="titleLarge">{
                                currentSection === 'general' ? 'General' :
                                    currentSection === 'tags' ? 'Tags' :
                                        currentSection === 'sorting' ? 'Sorting' :
                                            currentSection === 'recurring' ? 'Recurring Rules' : 'Templates'
                            }</Text>
                        </View>
                    }
                </Dialog.Title>
                <Dialog.Content style={{ minHeight: 400 }}>
                    {currentSection === 'main' && renderMainMenu()}

                    {currentSection === 'general' && (
                        <View>
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
                            <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                                Default target for your daily planning.
                            </Text>
                            <Divider style={styles.divider} />
                            <Text variant="titleMedium" style={styles.sectionTitle}>App Info</Text>
                            <Text>Version: 0.3.0 (Beta)</Text>
                        </View>
                    )}

                    {currentSection === 'sorting' && (
                        <ScrollView>
                            <Text variant="bodySmall" style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
                                Drag / Reorder criteria to change priority.
                            </Text>
                            {safeSortConfigs.map((config, index) => (
                                <View key={config.field} style={styles.sortRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                                            {config.field === 'tagPriority' ? 'Tag Priority' :
                                                config.field === 'estimatedTime' ? 'Estimated Time' : 'Creation Date'}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text variant="labelSmall" style={{ marginRight: 8 }}>
                                                {config.enabled ? (config.order === 'asc' ? 'Ascending' : 'Descending') : 'Disabled'}
                                            </Text>
                                            <Switch
                                                value={config.enabled}
                                                onValueChange={() => handleToggleSort(config.field)}
                                                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                            />
                                            {config.enabled && (
                                                <IconButton
                                                    icon={config.order === 'asc' ? "sort-ascending" : "sort-descending"}
                                                    size={20}
                                                    onPress={() => handleToggleSortDirection(config.field)}
                                                />
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row' }}>
                                        <IconButton
                                            icon="arrow-up"
                                            size={20}
                                            disabled={index === 0}
                                            onPress={() => handleSortMove(index, 'up')}
                                        />
                                        <IconButton
                                            icon="arrow-down"
                                            size={20}
                                            disabled={index === safeSortConfigs.length - 1}
                                            onPress={() => handleSortMove(index, 'down')}
                                        />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {currentSection === 'tags' && (
                        <View>
                            <View style={styles.tagInputContainer}>
                                <TextInput
                                    ref={inputRef}
                                    mode="outlined"
                                    label="New Tag Name"
                                    defaultValue=""
                                    onChangeText={setNewTagName}
                                    style={{ flex: 1, marginRight: 8 }}
                                    dense
                                    autoComplete="off"
                                    autoCorrect={false}
                                    spellCheck={false}
                                />
                                <Button mode="contained" onPress={handleAddTag} disabled={!newTagName.trim()}>
                                    Add
                                </Button>
                            </View>
                            <View style={styles.colorRow}>
                                {PRESET_COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorCircle,
                                            { backgroundColor: color },
                                            selectedColor === color && styles.selectedColor
                                        ]}
                                        onPress={() => setSelectedColor(color)}
                                    />
                                ))}
                            </View>

                            <ScrollView style={{ maxHeight: 300 }}>
                                <View style={styles.tagList}>
                                    {tags.map((tag, index) => (
                                        <View key={tag.id} style={styles.tagRow}>
                                            <Chip
                                                style={[styles.tagChip, { backgroundColor: tag.color + '20', flex: 1 }]}
                                                textStyle={{ color: tag.color }}
                                                onClose={() => deleteTag(tag.id)}
                                            >
                                                {tag.name}
                                            </Chip>
                                            <View style={styles.tagActions}>
                                                <IconButton
                                                    icon="arrow-up"
                                                    size={16}
                                                    disabled={index === 0}
                                                    onPress={() => moveTagPriority(tag.id, 'up')}
                                                    style={{ margin: 0 }}
                                                />
                                                <IconButton
                                                    icon="arrow-down"
                                                    size={16}
                                                    disabled={index === tags.length - 1}
                                                    onPress={() => moveTagPriority(tag.id, 'down')}
                                                    style={{ margin: 0 }}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                    {tags.length === 0 && <Text style={styles.hint}>No tags created yet.</Text>}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {currentSection === 'recurring' && renderRecurringRules()}

                    {currentSection === 'templates' && renderTemplates()}

                </Dialog.Content>
                <Dialog.Actions>
                    {currentSection !== 'main' ? (
                        <Button onPress={() => setCurrentSection('main')}>Back</Button>
                    ) : (
                        <Button onPress={onDismiss}>Close</Button>
                    )}
                    {/* Save logic is complex with split screens, simpler to auto-save or save on specific screens. 
                       Currently our store actions save immediately. 
                       For "Capacity" input, we need an explicit save or effect.
                       The original dialog had "Save" button for Capacity.
                       Let's keep "Save" only when in General section? 
                       Or better, auto-save capacity on blur? Or keep explicit Save button in General.
                   */}
                    {currentSection === 'general' && <Button onPress={handleSave}>Save</Button>}
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
        color: '#666', // onSurfaceVariant is better if accessed via theme, but here we are in static styles.
        // We will remove color here and use inline style or just rely on variant default?
        // Let's use inline style in the component render to access theme.
        marginTop: 4,
    },
    divider: {
        marginVertical: 16,
    },
    dangerButton: {
        marginTop: 8,
    },
    tagInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    colorRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    colorCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
    },
    selectedColor: {
        borderWidth: 2,
        borderColor: '#333',
    },
    tagList: {
        // flexDirection: 'row', // Change to column for priority reordering
        // flexWrap: 'wrap',
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    tagChip: {
        marginRight: 8,
    },
    tagActions: {
        flexDirection: 'row',
    },
    sortRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#f5f5f5',
        padding: 8,
        borderRadius: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    recurringRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        marginBottom: 8,
    }
});
