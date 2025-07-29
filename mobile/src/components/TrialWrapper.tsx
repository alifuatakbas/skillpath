import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePremium } from '../contexts/PremiumContext';
import PaywallScreen from '../screens/PaywallScreen';

interface TrialWrapperProps {
  children: React.ReactNode;
  navigation: any;
}

const TrialWrapper: React.FC<TrialWrapperProps> = ({ children, navigation }) => {
  const { isPremium, trialDaysLeft, isLoading } = usePremium();
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Trial süresi dolmuşsa ve premium değilse paywall göster
      if (trialDaysLeft <= 0 && !isPremium) {
        setShowPaywall(true);
      } else {
        setShowPaywall(false);
      }
    }
  }, [isPremium, trialDaysLeft, isLoading]);

  // Debug için log ekle
  console.log('TrialWrapper Debug:', { isPremium, trialDaysLeft, isLoading, showPaywall });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (showPaywall) {
    return <PaywallScreen navigation={navigation} />;
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
});

export default TrialWrapper; 