import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import PagerView from 'react-native-pager-view';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/theme/theme';

/* Screens */
import ProjectScreen from './src/screens/ProjectScreen';
import DailyScreen from './src/screens/DailyScreen';
import WeeklyScreen from './src/screens/WeeklyScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <PagerView style={styles.pagerView} initialPage={1}>
            <ProjectScreen key="0" />
            <DailyScreen key="1" />
            <WeeklyScreen key="2" />
          </PagerView>
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  pagerView: {
    flex: 1,
  },
});
