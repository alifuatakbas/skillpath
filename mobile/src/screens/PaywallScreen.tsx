import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePremium } from '../contexts/PremiumContext';
import { useIAP } from 'expo-iap';

// Subscription product interface
interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  localizedPrice: string;
}

const { width, height } = Dimensions.get('window');

interface PaywallScreenProps {
  navigation: any;
  route?: any;
}

// Test için fallback planlar (store'dan yüklenemezse)
const FALLBACK_PLANS: SubscriptionProduct[] = [
  {
    productId: 'skillpath_premium_monthly',
          title: 'Premium Monthly',
      description: 'All premium features',
    price: '6.99',
    currency: 'USD',
    localizedPrice: '$6.99',
  },
  {
    productId: 'skillpath_premium_yearly',
          title: 'Premium Yearly',
      description: 'All premium features + 33% discount',
    price: '55.99',
    currency: 'USD',
    localizedPrice: '$55.99',
  },
];

const PaywallScreen: React.FC<PaywallScreenProps> = ({ navigation, route }) => {
  const [plans, setPlans] = useState<SubscriptionProduct[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<string>('skillpath_premium_monthly');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // expo-iap hook kullan
  const { connected, products, requestProducts, requestPurchase, validateReceipt } = useIAP();
  
  // Premium context kullan
  const { refreshSubscription, trialDaysLeft, trialExpiryDate } = usePremium();

  useEffect(() => {
    // Varsayılan olarak aylık planı seç
    setSelectedPlan('skillpath_premium_monthly');
  }, []);

  useEffect(() => {
    // Store'dan ürünleri yükle
    if (connected) {
      requestProducts({ skus: ['skillpath_premium_monthly', 'skillpath_premium_yearly'], type: 'subs' });
    } else {
    }
  }, [connected, requestProducts]);

  useEffect(() => {
    // Purchase listener - expo-iap'te purchase-updated event'ini dinle
    // Not: expo-iap'te event listener yok, purchase sonrası manuel handle ediyoruz
  }, []);

  const handleStartTrial = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    try {
      setPurchasing(true);
      // Satın alma işlemini başlat
      const purchase = await requestPurchase({
        request: { sku: selectedPlan },
        type: 'subs'
      } as any);

      // Purchase başarılıysa backend'e gönder
      if (purchase && purchase.transactionId) {
        // App-level receipt al (expo-iap'te bu farklı olabilir)
        const appReceipt = purchase.transactionReceipt || 'dummy_receipt';
        
        // Backend'e verify et
        const token = await AsyncStorage.getItem('skillpath_token');
        const { AppConfig } = await import('../config/environment');
        
        const res = await fetch(`${AppConfig.API_BASE_URL}/api/iap/verify`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            platform: 'ios',
            receipt: appReceipt,
            product_id: purchase?.productId ?? selectedPlan,
            original_transaction_id: purchase?.originalTransactionIdentifier ?? purchase?.transactionId,
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          await refreshSubscription();
          Alert.alert('Success', 'Purchase verified.');
          navigation.goBack();
        } else {
          Alert.alert('Error', data?.message || 'Verification failed.');
        }
      } else {
        Alert.alert('Error', 'Purchase could not be completed.');
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('cancel')) {
        Alert.alert('Cancelled', 'Purchase was cancelled.');
      } else {
        Alert.alert('Error', msg || 'Purchase failed.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      // Basit restore - kullanıcının mevcut abonelik durumunu kontrol et
      const token = await AsyncStorage.getItem('skillpath_token');
      const { AppConfig } = await import('../config/environment');
      
      const res = await fetch(`${AppConfig.API_BASE_URL}/api/premium/restore`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          receipt: 'dummy_receipt' // expo-iap'te app-level receipt alma farklı
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await refreshSubscription();
        Alert.alert('Success', 'Purchases restored.');
      } else {
        Alert.alert('Info', data?.message || 'No active subscription to restore.');
      }
    } catch {
      Alert.alert('Error', 'Restore failed.');
    }
  };

  // Plan bilgilerini düzenle
  const getPlanDisplayInfo = (plan: SubscriptionProduct) => {
    const isYearly = plan.productId.includes('yearly');
    const isLifetime = plan.productId.includes('lifetime');
    const monthlyPrice = isYearly ? (parseFloat(plan.price) / 12).toFixed(2) : plan.price;
    const savings = isYearly ? Math.round(((6.99 - parseFloat(monthlyPrice)) / 6.99) * 100) : 0;
    
    return {
      title: plan.title,
      price: plan.localizedPrice,
      pricePerMonth: isLifetime ? 'Tek seferlik' : (isYearly ? `$${monthlyPrice}/ay` : `${plan.localizedPrice}/ay`),
      savings: isYearly ? `%${savings} tasarruf` : null,
      isPopular: isYearly,
      description: plan.description,
    };
  };

  const premiumFeatures = [
    {
      icon: 'infinite-outline',
      title: 'Infinite Roadmap',
      description: 'Create as many learning paths as you want',
    },
    {
      icon: 'sparkles-outline',
      title: 'Advanced AI Recommendations',
      description: 'Personalized learning recommendations',
    },
    {
      icon: 'analytics-outline',
      title: 'Detailed Analytics',
      description: 'Track your progress in detail',
    },
    {
      icon: 'trophy-outline',
      title: 'Badges & Achievements',
      description: 'Rewards that boost your motivation',
    },
    {
      icon: 'people-outline',
      title: 'Learning Groups',
      description: 'Interact with other learners',
    },
    {
      icon: 'school-outline',
      title: 'Mentor Support',
      description: 'Get support from expert mentors',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6366f1', '#8b5cf6', '#ec4899']}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>SkillPath Premium</Text>
          <Text style={styles.headerSubtitle}>
            Take your learning journey to the next level
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trial Info */}
        {trialDaysLeft > 0 && (
          <View style={styles.trialContainer}>
            <View style={styles.trialBadge}>
              <Ionicons name="time-outline" size={20} color="#fff" />
              <Text style={styles.trialBadgeText}>{trialDaysLeft} Days Left</Text>
            </View>
            <Text style={styles.trialTitle}>Your Free Trial</Text>
            <Text style={styles.trialDescription}>
              {trialExpiryDate ? 
                              `Try all premium features for free until ${trialExpiryDate.toLocaleDateString('en-US')}!` :
              'Try all premium features for free for 3 days!'
              }
            </Text>
            <Text style={styles.trialWarning}>
              ⚠️ You will be automatically subscribed to the selected plan at the end of the trial.
            </Text>
          </View>
        )}

        {/* Premium Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Features</Text>
          {premiumFeatures.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={24} color="#6366f1" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Subscription Plans */}
        <View style={styles.plansContainer}>
          <Text style={styles.plansTitle}>Subscription Plans</Text>
          {plans.map((plan) => {
            const displayInfo = getPlanDisplayInfo(plan);
            return (
              <TouchableOpacity
                key={plan.productId}
                style={[
                  styles.planItem,
                  selectedPlan === plan.productId && styles.selectedPlan,
                  displayInfo.isPopular && styles.popularPlan,
                ]}
                onPress={() => setSelectedPlan(plan.productId)}
              >
                {displayInfo.isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                  </View>
                )}
                
                <View style={styles.planHeader}>
                  <View style={styles.planTitleSection}>
                    <Text style={styles.planTitle}>{displayInfo.title}</Text>
                    <Text style={styles.planPrice}>{displayInfo.price}</Text>
                  </View>
                  
                  <View style={styles.radioButton}>
                    {selectedPlan === plan.productId && (
                      <View style={styles.radioButtonSelected} />
                    )}
                  </View>
                </View>
                
                <Text style={styles.planDescription}>{displayInfo.description}</Text>
                
                <View style={styles.planDetails}>
                  <Text style={styles.planPricePerMonth}>{displayInfo.pricePerMonth}</Text>
                  {displayInfo.savings && (
                    <Text style={styles.planSavings}>{displayInfo.savings}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Purchase Button */}
        <TouchableOpacity
          style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
          onPress={handleStartTrial}
          disabled={purchasing}
        >
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            style={styles.purchaseButtonGradient}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.purchaseButtonText}>Start Free Trial</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.footerLink}>Restore Purchases</Text>
          </TouchableOpacity>
          
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => {
              import('../config/environment').then(({ AppConfig }) => {
                const url = `${AppConfig.API_BASE_URL}/terms`;
                const { Linking } = require('react-native');
                Linking.openURL(url);
              });
            }}>
              <Text style={styles.footerLink}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.footerSeparator}> • </Text>
            <TouchableOpacity onPress={() => {
              import('../config/environment').then(({ AppConfig }) => {
                const url = `${AppConfig.API_BASE_URL}/privacy`;
                const { Linking } = require('react-native');
                Linking.openURL(url);
              });
            }}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footerNote}>
            Subscriptions renew automatically. You can cancel anytime in your App Store or Google Play settings.
          </Text>
        </View>
      </ScrollView>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginTop: 30,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  featureDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  plansContainer: {
    marginTop: 40,
  },
  plansTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
  },
  planItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  selectedPlan: {
    borderColor: '#6366f1',
    backgroundColor: '#f8faff',
  },
  popularPlan: {
    borderColor: '#ec4899',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#ec4899',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitleSection: {
    flex: 1,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  planDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  planDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planPricePerMonth: {
    fontSize: 16,
    color: '#475569',
  },
  planSavings: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366f1',
  },
  purchaseButton: {
    marginTop: 30,
    marginBottom: 20,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  footerLink: {
    color: '#6366f1',
    fontSize: 14,
  },
  footerSeparator: {
    color: '#94a3b8',
    fontSize: 14,
  },
  footerNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  // Trial styles
  trialContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  trialBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  trialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  trialDescription: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
  },
  trialWarning: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default PaywallScreen; 
