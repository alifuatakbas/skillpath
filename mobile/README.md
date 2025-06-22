# SkillPath - Store'a Geçiş Rehberi 🚀

## Test'ten Production'a Geçiş

### 1. App Store Connect (iOS)
```bash
1. Apple Developer hesabı aç ($99/yıl)
2. App Store Connect > My Apps > SkillPath
3. Features > In-App Purchases
4. Ürünleri oluştur:
   - skillpath_premium_monthly (Type: Auto-Renewable Subscription)
   - skillpath_premium_yearly (Type: Auto-Renewable Subscription)
5. Fiyatları belirle ($9.99, $79.99)
6. "Ready to Submit" yap
```

### 2. Google Play Console (Android)
```bash
1. Google Play Developer hesabı aç ($25 tek seferlik)
2. Play Console > SkillPath App
3. Monetization > Products > Subscriptions
4. Aynı ürünleri oluştur
5. Aktif et
```

### 3. Kod Değişikliği
**HİÇBİR KOD DEĞİŞİKLİĞİ GEREKMİYOR!** 🎉

Sadece store'larda ürün ID'leri aynı olsun:
- `skillpath_premium_monthly`
- `skillpath_premium_yearly`

### 4. Test Etme
```bash
# iOS Simulator'da test et
npx expo run:ios

# Android Emulator'da test et  
npx expo run:android
```

### 5. Yayınlama
- iOS: App Store'a gönder
- Android: Play Store'a gönder
- Store'lar onayladıktan sonra otomatik çalışır!

## Önemli Notlar
- Test sırasında gerçek para çekilmez
- Production'da gerçek ödemeler başlar
- Store komisyonu: %30 (Apple/Google alır)
- Sen %70 alırsın

## Destek
Herhangi bir sorun olursa React Native IAP dokümantasyonuna bak:
https://github.com/dooboolab/react-native-iap 