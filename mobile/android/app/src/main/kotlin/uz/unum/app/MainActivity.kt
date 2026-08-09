package uz.unum.app

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Calendar

/**
 * Ekran vaqti (Screen Time) uchun native ko'prik.
 *
 * NIMA UCHUN NATIVE. Android'da ilova foydalanish statistikasini faqat
 * `UsageStatsManager` beradi va u oddiy ruxsat emas, `PACKAGE_USAGE_STATS`
 * — foydalanuvchi uni tizim sozlamalaridan QO'LDA yoqadi. Flutter uchun
 * ishonchli paket yo'q, shuning uchun uch metodli kichik kanal yozildi.
 *
 * ⚠️ Bu yerda hech qanday ilova NOMI Dart tomonga uzatilmaydi — faqat
 * jami daqiqa. Qaysi ilovani qancha ishlatgani juda nozik ma'lumot va
 * bizga kerak emas; kerak bo'lmagan narsani o'qimaymiz.
 */
/// ⚠️ `FlutterFragmentActivity` — `FlutterActivity` EMAS.
///
/// `health` paketi Health Connect ruxsat oynasini `ActivityResultLauncher`
/// orqali ochadi, uni esa faqat FragmentActivity ro'yxatdan o'tkaza oladi.
/// Oddiy `FlutterActivity` bilan ruxsat so'ralganda paket jimgina
/// "Permission launcher not found" deb logga yozadi va OYNA UMUMAN
/// OCHILMAYDI — foydalanuvchi esa "ruxsat berilmadi" degan xabarni ko'radi.
class MainActivity : FlutterFragmentActivity() {

    private val channel = "uz.unum.app/screentime"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "hasPermission" -> result.success(hasUsagePermission())
                    "openSettings" -> {
                        openUsageSettings()
                        result.success(true)
                    }
                    "todayMinutes" -> {
                        if (!hasUsagePermission()) {
                            // `null` — "bilmaymiz". Nol qaytarsak "bugun
                            // telefonni umuman ishlatmadingiz" degan
                            // yolg'on ko'rsatkich chiqardi.
                            result.success(null)
                        } else {
                            result.success(todayForegroundMinutes())
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun hasUsagePermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun openUsageSettings() {
        try {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        } catch (_: Exception) {
            // Ba'zi qobiqlarda bu ekran yo'q — umumiy sozlamaga tushamiz.
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    /**
     * Bugun ekran yoqiq bo'lgan jami daqiqa.
     *
     * `queryUsageStats` emas, `queryEvents` ishlatiladi: birinchisi
     * qurilmaga qarab kunlik oynani boshqacha yaxlitlaydi va bir necha
     * barobar katta raqam berishi mumkin. Hodisalarni o'zimiz sanasak,
     * "oldinga chiqdi → orqaga ketdi" oralig'i aniq hisoblanadi.
     */
    private fun todayForegroundMinutes(): Int {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        val start = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val end = System.currentTimeMillis()

        val events = usm.queryEvents(start, end)
        val event = android.app.usage.UsageEvents.Event()

        // Har bir paket uchun oxirgi "oldinga chiqqan" vaqti.
        val openedAt = HashMap<String, Long>()
        var total = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            when (event.eventType) {
                android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED ->
                    openedAt[event.packageName] = event.timeStamp

                android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED -> {
                    val from = openedAt.remove(event.packageName)
                    if (from != null && event.timeStamp > from) {
                        total += event.timeStamp - from
                    }
                }
            }
        }

        // Hozir ochiq turgan ilova(lar) — hali "paused" bo'lmagan.
        for (from in openedAt.values) {
            if (end > from) total += end - from
        }

        val minutes = total / 60000
        // Bir kunda 24 soatdan ko'p bo'lishi mumkin emas; bo'linib ketgan
        // hodisalar tufayli chiqib ketsa cheklaymiz.
        return minutes.coerceIn(0, 1440).toInt()
    }
}
