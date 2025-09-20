import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface LegalScreenProps {
  navigation: any;
}

const LegalScreen: React.FC<LegalScreenProps> = ({ navigation }) => {
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal Information</Text>
          <Text style={styles.cardDescription}>
            Access our legal documents and policies
          </Text>
        </View>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => {
            import('../config/environment').then(({ AppConfig }) => {
              const url = `${AppConfig.API_BASE_URL}/privacy`;
              openLink(url);
            });
          }}
        >
          <View style={styles.linkContent}>
            <View style={styles.linkIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#667eea" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Privacy Policy</Text>
              <Text style={styles.linkDescription}>
                How we collect, use, and protect your data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        </TouchableOpacity>

        {/* Terms of Use */}
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => {
            import('../config/environment').then(({ AppConfig }) => {
              const url = `${AppConfig.API_BASE_URL}/terms`;
              openLink(url);
            });
          }}
        >
          <View style={styles.linkContent}>
            <View style={styles.linkIcon}>
              <Ionicons name="document-text" size={24} color="#667eea" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Terms of Use (EULA)</Text>
              <Text style={styles.linkDescription}>
                Terms and conditions for using SkillPath
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        </TouchableOpacity>

        {/* Contact Support */}
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => {
            import('../config/environment').then(({ AppConfig }) => {
              const url = `${AppConfig.API_BASE_URL}/support`;
              openLink(url);
            });
          }}
        >
          <View style={styles.linkContent}>
            <View style={styles.linkIcon}>
              <Ionicons name="help-circle" size={24} color="#667eea" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Support</Text>
              <Text style={styles.linkDescription}>
                Get help and contact our support team
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        </TouchableOpacity>

        {/* Account Deletion */}
        <TouchableOpacity
          style={styles.linkCard}
          onPress={() => {
            import('../config/environment').then(({ AppConfig }) => {
              const url = `${AppConfig.API_BASE_URL}/delete-account`;
              openLink(url);
            });
          }}
        >
          <View style={styles.linkContent}>
            <View style={styles.linkIcon}>
              <Ionicons name="trash" size={24} color="#ef4444" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Delete Account</Text>
              <Text style={styles.linkDescription}>
                Permanently delete your account and data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  linkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  linkText: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  linkDescription: {
    fontSize: 14,
    color: '#64748b',
  },
});

export default LegalScreen;
