import * as Localization from 'expo-localization';

export interface TimezoneInfo {
  timezone: string;
  deviceTimezone: string;
  locale: string;
  country: string;
}

/**
 * Automatically detect user's timezone using Expo Localization
 */
export const detectTimezone = async (): Promise<TimezoneInfo> => {
  try {
    console.log('🌍 Detecting timezone...');
    
    // Method 1: Use Expo Localization
    let timezone = Localization.timezone || 'UTC';
    let locale = Localization.locale || 'en-US';
    
    console.log('📍 Expo Localization:', {
      timezone,
      locale,
      locales: Localization.locales,
      region: Localization.region
    });
    
    // Method 2: Fallback to JavaScript Intl API
    let fallbackTimezone = 'UTC';
    try {
      fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🔄 Fallback timezone from Intl:', fallbackTimezone);
    } catch (intlError) {
      console.warn('⚠️ Intl API failed:', intlError);
    }
    
    // Use fallback if main method failed
    if (!timezone || timezone === 'UTC') {
      timezone = fallbackTimezone;
    }
    
    // Extract country from locale
    let country = 'Unknown';
    try {
      const localeParts = locale.split('-');
      if (localeParts.length > 1) {
        country = localeParts[1].toUpperCase();
      }
      // Alternative: use region if available
      if (Localization.region) {
        country = Localization.region;
      }
    } catch (error) {
      console.warn('⚠️ Country extraction failed:', error);
    }
    
    const timezoneInfo: TimezoneInfo = {
      timezone: timezone,
      deviceTimezone: timezone, // Same as timezone for Expo
      locale: locale,
      country: country
    };
    
    console.log('✅ Timezone detection successful:', timezoneInfo);
    return timezoneInfo;
    
  } catch (error) {
    console.error('❌ Timezone detection failed:', error);
    
    // Final fallback
    const fallbackInfo: TimezoneInfo = {
      timezone: 'UTC',
      deviceTimezone: 'UTC',
      locale: 'en-US',
      country: 'Unknown'
    };
    
    console.log('🔄 Using fallback timezone info:', fallbackInfo);
    return fallbackInfo;
  }
};

/**
 * Get optimal notification times based on timezone
 */
export const getOptimalNotificationTimes = (timezone: string) => {
  // Customize notification times based on timezone
  const timeCustomizations: { [key: string]: { morning: string; evening: string } } = {
    'Europe/Istanbul': { morning: '09:00', evening: '20:00' },
    'America/New_York': { morning: '08:00', evening: '19:00' },
    'Asia/Tokyo': { morning: '07:00', evening: '18:00' },
    'Europe/London': { morning: '09:00', evening: '20:00' },
    'America/Los_Angeles': { morning: '08:30', evening: '19:30' },
  };
  
  return timeCustomizations[timezone] || { morning: '09:00', evening: '20:00' };
};

/**
 * Check if current time is in Do Not Disturb hours
 */
export const isInDoNotDisturbHours = (
  currentTime: Date,
  dndStart: string,
  dndEnd: string,
  timezone?: string
): boolean => {
  try {
    const [startHour, startMinute] = dndStart.split(':').map(Number);
    const [endHour, endMinute] = dndEnd.split(':').map(Number);
    
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (startTotalMinutes > endTotalMinutes) {
      return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
    } else {
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    }
  } catch (error) {
    console.error('Error checking DND hours:', error);
    return false;
  }
};

/**
 * Format time in specific timezone
 */
export const formatTimeInTimezone = (date: Date, timezone?: string): string => {
  try {
    if (timezone && timezone !== 'UTC') {
      return date.toLocaleString('tr-TR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    return date.toLocaleString('tr-TR');
  } catch (error) {
    console.error('Error formatting time in timezone:', error);
    return date.toLocaleString('tr-TR');
  }
}; 