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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { subscriptionService, SubscriptionProduct } from '../services/subscriptionService';
import { usePremium } from '../contexts/PremiumContext';

const { width, height } = Dimensions.get('window');

interface PaywallScreenProps {
  navigation: any;
  route?: any;
}

// Test için fallback planlar (store'dan yüklenemezse)
const FALLBACK_PLANS: SubscriptionProduct[] = [
  {
    productId: 'skillpath_premium_monthly',
    title: 'Premium Aylık',
    description: 'Tüm premium özellikler',
    price: '9.99',
    currency: 'USD',
    localizedPrice: '$9.99',
  },
  {
    productId: 'skillpath_premium_yearly',
    title: 'Premium Yıllık',
    description: 'Tüm premium özellikler + %33 indirim',
    price: '79.99',
    currency: 'USD',
    localizedPrice: '$79.99',
  },
];

const PaywallScreen: React.FC<PaywallScreenProps> = ({ navigation, route }) => {
  const [plans, setPlans] = useState<SubscriptionProduct[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  
  // Premium context kullan
  const { refreshSubscription } = usePremium();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      // Subscription service'i başlat
      await subscriptionService.initialize();
      
      // Store'dan planları yüklemeye çalış
      const availablePlans = await subscriptionService.getAvailableSubscriptions();
      
      // Eğer store'dan plan gelmezse fallback kullan
      const plansToUse = availablePlans.length > 0 ? availablePlans : FALLBACK_PLANS;
      setPlans(plansToUse);
      
      // Varsayılan olarak yıllık planı seç
      const yearlyPlan = plansToUse.find(plan => plan.productId.includes('yearly'));
      if (yearlyPlan) {
        setSelectedPlan(yearlyPlan.productId);
      } else if (plansToUse.length > 0) {
        setSelectedPlan(plansToUse[0].productId);
      }
      
      console.log('📦 Loaded plans:', plansToUse);
    } catch (error) {
      console.error('Failed to load plans:', error);
      // Hata durumunda fallback planları kullan
      setPlans(FALLBACK_PLANS);
      setSelectedPlan(FALLBACK_PLANS[1].productId); // Yıllık planı seç
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      Alert.alert('Hata', 'Lütfen bir plan seçin');
      return;
    }

    setPurchasing(true);
    try {
      const result = await subscriptionService.purchaseSubscription(selectedPlan);
      
      if (result) {
        // Premium durumunu yenile
        await refreshSubscription();
        
        Alert.alert(
          'Başarılı! 🎉',
          'Premium aboneliğiniz aktif edildi. Artık tüm özelliklerden yararlanabilirsiniz!',
          [
            {
              text: 'Harika!',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Hata', 'Satın alma işlemi başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      const status = await subscriptionService.checkSubscriptionStatus();
      if (status.isActive) {
        // Premium durumunu yenile
        await refreshSubscription();
        
        Alert.alert(
          'Abonelik Geri Yüklendi! 🎉',
          'Premium aboneliğiniz başarıyla geri yüklendi.',
          [{ text: 'Tamam', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Bilgi', 'Geri yüklenecek abonelik bulunamadı.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Abonelik geri yükleme başarısız');
    }
  };

  // Plan bilgilerini düzenle
  const getPlanDisplayInfo = (plan: SubscriptionProduct) => {
    const isYearly = plan.productId.includes('yearly');
    const monthlyPrice = isYearly ? (parseFloat(plan.price) / 12).toFixed(2) : plan.price;
    const savings = isYearly ? Math.round(((9.99 - parseFloat(monthlyPrice)) / 9.99) * 100) : 0;
    
    return {
      title: isYearly ? 'Premium Yıllık' : 'Premium Aylık',
      price: plan.localizedPrice,
      pricePerMonth: isYearly ? `$${monthlyPrice}/ay` : `${plan.localizedPrice}/ay`,
      savings: isYearly ? `%${savings} tasarruf` : null,
      isPopular: isYearly,
      description: isYearly ? 'Tüm premium özellikler + %33 indirim' : 'Tüm premium özellikler',
    };
  };

  const premiumFeatures = [
    {
      icon: 'infinite-outline',
      title: 'Sınırsız Roadmap',
      description: 'İstediğiniz kadar öğrenme yolu oluşturun',
    },
    {
      icon: 'sparkles-outline',
      title: 'Gelişmiş AI Öneriler',
      description: 'Kişiselleştirilmiş öğrenme önerileri',
    },
    {
      icon: 'analytics-outline',
      title: 'Detaylı Analitik',
      description: 'İlerlemenizi detaylı takip edin',
    },
    {
      icon: 'trophy-outline',
      title: 'Rozet & Başarımlar',
      description: 'Motivasyonunuzu artıran ödüller',
    },
    {
      icon: 'people-outline',
      title: 'Öğrenme Grupları',
      description: 'Diğer öğrencilerle etkileşim',
    },
    {
      icon: 'school-outline',
      title: 'Mentor Desteği',
      description: 'Uzman mentorlardan destek alın',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Planlar yükleniyor...</Text>
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
            Öğrenme yolculuğunuzu bir üst seviyeye taşıyın
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Premium Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Özellikler</Text>
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
          <Text style={styles.plansTitle}>Abonelik Planları</Text>
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
          onPress={handlePurchase}
          disabled={purchasing}
        >
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            style={styles.purchaseButtonGradient}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.purchaseButtonText}>Premium'a Geç</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.footerLink}>Satın Alımları Geri Yükle</Text>
          </TouchableOpacity>
          
          <View style={styles.footerLinks}>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Kullanım Koşulları</Text>
            </TouchableOpacity>
            <Text style={styles.footerSeparator}> • </Text>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Gizlilik Politikası</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footerNote}>
            Abonelik otomatik olarak yenilenir. İptal etmek için App Store veya Google Play Store ayarlarından yapabilirsiniz.
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
});

export default PaywallScreen; 