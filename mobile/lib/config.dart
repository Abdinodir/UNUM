/// App-wide configuration.
///
/// The OpenAI token lives on the BACKEND server, never in this app. The app
/// only needs to know the backend's public HTTPS URL.
///
/// This must stay in sync with what `deploy.sh` prints at the end of a deploy.
class AppConfig {
  /// Public URL of the UNUM backend.
  ///
  /// Must be a permanent public HTTPS address — never a quick tunnel
  /// (trycloudflare/ngrok), which expires and leaves already-shipped builds
  /// pointing at a dead host.
  ///
  /// Overridable at build time so a USB-connected phone can talk to a local
  /// server through `adb reverse`, without ever editing this file:
  ///
  ///     adb reverse tcp:3000 tcp:3000
  ///     flutter run --dart-define=UNUM_BACKEND=http://127.0.0.1:3000
  ///
  /// Release builds pass no define, so they always get the production URL.
  static const String defaultBackendUrl = String.fromEnvironment(
    'UNUM_BACKEND',
    defaultValue: 'https://your-server.example.com',
  );

  /// Google Sign-In uchun **WEB** client ID.
  ///
  /// Native SDK shu qiymatni `serverClientId` sifatida oladi va natijadagi
  /// `id_token` ning `aud` i shunga teng bo'ladi — server aynan shuni kutadi.
  /// Android uchun alohida OAuth client ham kerak (SHA-1 bilan), lekin uning
  /// ID'si kodda yozilmaydi: SDK uni Google'dan o'zi topadi.
  static const String googleServerClientId =
      '634015008083-tj6j9ggefevlqbddbi6abn44ecrd0p2p.apps.googleusercontent.com';

  static const String appName = 'UNUM';

  /// Linked from Profile and from the account-deletion flow.
  static const String privacyPolicyUrl = '$defaultBackendUrl/privacy.html';
  static const String supportEmail = 'telba0702@gmail.com';

  /// Telegram bot. Ulanish kodi bu havolaga qo'shiladi, shuning uchun
  /// foydalanuvchi kodni ko'rmaydi ham, yozmaydi ham.
  static const String botUsername = 'unumlife_bot';
  static const String botLink = 'https://t.me/$botUsername';
}
