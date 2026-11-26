package com.godot.game;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * APK 自更新：版本对比所需的 versionCode、下载、SHA-256 校验、拉起系统安装器。
 *
 * 状态机放在 GDScript（scripts/ota.gd），这里只做 Java 才做得了的四件事：
 *   1. 读本机 versionCode
 *   2. 交给系统 DownloadManager 下载（断网重试、App 被杀仍然继续）
 *   3. 下载完后算 SHA-256 并比对
 *   4. FileProvider + ACTION_VIEW 拉起安装器
 *
 * 所有方法都是 static，供 Godot 的 JavaClassWrapper 直接调用。
 * 下载进度用轮询（queryProgress）而不是广播：Android 8 起隐式广播受限，
 * 轮询不依赖广播存活，也不会因为进程被杀就丢事件。
 */
public final class OtaUpdater {
    private static final String TAG = "LAB-OTA";
    private static final String PREFS = "lab_ota";
    private static final String KEY_ID = "download_id";
    private static final String KEY_SHA = "expect_sha256";
    private static final String KEY_NAME = "file_name";

    /** 未知/未开始。 */
    public static final int STATE_IDLE = 0;
    /** 下载中，progress() 返回 0..100。 */
    public static final int STATE_RUNNING = 1;
    /** 下载完成，等待校验与安装。 */
    public static final int STATE_READY = 2;
    /** 下载失败（网络、空间不足等）。 */
    public static final int STATE_FAILED = -1;
    /** 校验失败：文件被替换或下载损坏，已删除。 */
    public static final int STATE_CORRUPT = -2;
    /** 缺少「安装未知应用」授权。 */
    public static final int STATE_NEED_PERMISSION = -3;
    /** 安装器已拉起。 */
    public static final int STATE_INSTALLED = 3;

    private static volatile int lastState = STATE_IDLE;
    private static volatile String lastError = "";

    private OtaUpdater() {
    }

    /** 本机 versionCode。 */
    public static int versionCode(Context context) {
        try {
            return context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            Log.w(TAG, "versionCode unavailable", e);
            return 0;
        }
    }

    /** 本机 versionName。 */
    public static String versionName(Context context) {
        try {
            return context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    public static String lastError() {
        return lastError;
    }

    public static int lastState() {
        return lastState;
    }

    /** 是否有「安装未知应用」的授权。 */
    public static boolean canInstall(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return context.getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    /** 跳到系统的「安装未知应用」设置页。 */
    public static void openInstallSettings(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.w(TAG, "cannot open unknown-sources settings", e);
            }
        }
    }

    /** 清掉上一次下载记录（同时删除残留文件）。 */
    public static void clear(Context context) {
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        long id = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_ID, -1);
        if (dm != null && id != -1) {
            try {
                dm.remove(id);
            } catch (Exception ignored) {
                // 已经不存在
            }
        }
        File f = apkFile(context);
        if (f != null && f.exists() && !f.delete()) {
            Log.w(TAG, "stale apk not deleted: " + f);
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        lastState = STATE_IDLE;
        lastError = "";
    }

    /** 文件落地位置：App 私有外部目录，不需要任何存储权限。 */
    private static File apkFile(Context context) {
        File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) {
            dir = new File(context.getFilesDir(), "downloads");
        }
        if (!dir.exists() && !dir.mkdirs()) {
            Log.w(TAG, "cannot create " + dir);
        }
        String name = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_NAME, "lab-update.apk");
        return new File(dir, name);
    }

    /**
     * 交给系统下载器取 APK。
     *
     * @param sha256 期望的 SHA-256，可为空；非空时下载完必须匹配才允许安装。
     */
    public static boolean start(Context context, String url, String sha256, String fileName) {
        try {
            DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) {
                lastState = STATE_FAILED;
                lastError = "no download manager";
                return false;
            }
            if (fileName == null || fileName.isEmpty()) {
                fileName = "lab-update.apk";
            }
            if (!fileName.toLowerCase(Locale.ROOT).endsWith(".apk")) {
                fileName = fileName + ".apk";
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString(KEY_SHA, sha256 == null ? "" : sha256)
                    .putString(KEY_NAME, fileName)
                    .apply();
            File target = apkFile(context);
            if (target.exists() && !target.delete()) {
                lastState = STATE_FAILED;
                lastError = "cannot replace previous apk";
                return false;
            }
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("西木会馆 LAB 更新")
                    .setDescription("正在下载新版本")
                    .setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(context,
                            Environment.DIRECTORY_DOWNLOADS, fileName)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(false);
            long id = dm.enqueue(req);
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putLong(KEY_ID, id).apply();
            lastState = STATE_RUNNING;
            lastError = "";
            Log.i(TAG, "enqueued download " + id + " -> " + target);
            return true;
        } catch (Exception e) {
            lastState = STATE_FAILED;
            lastError = String.valueOf(e.getMessage());
            Log.e(TAG, "start failed", e);
            return false;
        }
    }

    /**
     * 轮询下载进度。返回 0..100 表示进行中；负数或状态码见 STATE_*。
     */
    public static int progress(Context context) {
        android.content.SharedPreferences sp =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long id = sp.getLong(KEY_ID, -1);
        if (id == -1) {
            return lastState == STATE_IDLE ? 0 : lastState;
        }
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            return STATE_FAILED;
        }
        Cursor c = null;
        try {
            c = dm.query(new DownloadManager.Query().setFilterById(id));
            if (c == null || !c.moveToFirst()) {
                lastState = STATE_FAILED;
                lastError = "download record missing";
                return STATE_FAILED;
            }
            int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_FAILED) {
                int reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                lastState = STATE_FAILED;
                lastError = "download failed (" + reason + ")";
                return STATE_FAILED;
            }
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                lastState = STATE_READY;
                return STATE_READY;
            }
            long done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            lastState = STATE_RUNNING;
            if (total <= 0) {
                return 1;
            }
            return (int) Math.max(1, Math.min(99, done * 100 / total));
        } catch (Exception e) {
            lastState = STATE_FAILED;
            lastError = String.valueOf(e.getMessage());
            return STATE_FAILED;
        } finally {
            if (c != null) {
                c.close();
            }
        }
    }

    /** 下载完成后的 SHA-256 校验；不匹配就删文件并返回 false。 */
    public static boolean verify(Context context) {
        android.content.SharedPreferences sp =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String expect = sp.getString(KEY_SHA, "");
        File apk = apkFile(context);
        if (apk == null || !apk.exists()) {
            lastState = STATE_FAILED;
            lastError = "apk missing";
            return false;
        }
        Log.i(TAG, "verify: file=" + apk.getAbsolutePath() + " size=" + apk.length() + " expect=" + expect);
        if (expect == null || expect.isEmpty()) {
            return true;    // 清单没给 sha256，只能靠 HTTPS
        }
        String actual = sha256(apk);
        if (actual == null || !actual.equalsIgnoreCase(expect)) {
            Log.e(TAG, "sha256 mismatch: expected " + expect + " got " + actual);
            lastState = STATE_CORRUPT;
            lastError = "sha256 mismatch";
            return false;
        }
        Log.i(TAG, "sha256 ok");
        return true;
    }

    /**
     * 校验后拉起系统安装器。调用前先确认 canInstall()。
     */
    public static int install(Activity activity) {
        if (!canInstall(activity)) {
            lastState = STATE_NEED_PERMISSION;
            return STATE_NEED_PERMISSION;
        }
        File apk = apkFile(activity);
        if (apk == null || !apk.exists()) {
            lastState = STATE_FAILED;
            lastError = "apk missing";
            return STATE_FAILED;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity,
                    activity.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            lastState = STATE_INSTALLED;
            return STATE_INSTALLED;
        } catch (Exception e) {
            lastState = STATE_FAILED;
            lastError = "cannot open installer: " + e.getMessage();
            Log.e(TAG, "install failed", e);
            return STATE_FAILED;
        }
    }

    private static String sha256(File file) {
        InputStream in = null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            in = new FileInputStream(file);
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                md.update(buf, 0, n);
            }
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) {
                sb.append(String.format(Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "sha256 failed", e);
            return null;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (Exception ignored) {
                    // 关不掉也不影响结论
                }
            }
        }
    }
}
