import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import PagerView from 'react-native-pager-view';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/* Screens */
import PoolScreen from './src/screens/PoolScreen';
import DailyScreen from './src/screens/DailyScreen';
import WeeklyScreen from './src/screens/WeeklyScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <PagerView style={styles.pagerView} initialPage={1}>
            <PoolScreen key="0" />
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
    backgroundColor: '#fff',
  },
  pagerView: {
    flex: 1,
  },
});
