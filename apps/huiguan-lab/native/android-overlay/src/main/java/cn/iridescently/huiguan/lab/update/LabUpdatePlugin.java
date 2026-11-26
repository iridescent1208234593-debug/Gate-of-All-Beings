package cn.iridescently.huiguan.lab.update;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import java.io.File;
import java.security.MessageDigest;
import androidx.core.content.FileProvider;
import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.UsedByGodot;

/** System installer for the independently signed public LAB package. */
public final class LabUpdatePlugin extends GodotPlugin {
    private static final String NAME = "LabPublicUpdateInstaller";
    private static final String PACKAGE_ID = "cn.iridescently.huiguan.lab.public";

    public LabUpdatePlugin(Godot godot) { super(godot); }
    @Override public String getPluginName() { return NAME; }

    // No remote-supplied path, package name, URI, or Activity is used.
    @UsedByGodot public int install(int expectedVersion, String expectedCertificate) {
        Activity activity = getActivity();
        if (activity == null || Build.VERSION.SDK_INT < 28 || expectedVersion < 1
                || !PACKAGE_ID.equals(activity.getPackageName())
                || expectedCertificate == null || !expectedCertificate.matches("[0-9a-f]{64}")) {
            return refused("unsupported client identity");
        }
        try {
            File original = new File(activity.getFilesDir().getCanonicalFile(), "updates/huiguan-next.apk");
            File apk = original.getCanonicalFile();
            if (!original.getAbsolutePath().equals(apk.getAbsolutePath()) || !apk.isFile()) {
                return refused("APK path");
            }
            PackageManager pm = activity.getPackageManager();
            PackageInfo current = pm.getPackageInfo(PACKAGE_ID, PackageManager.GET_SIGNING_CERTIFICATES);
            PackageInfo next = pm.getPackageArchiveInfo(apk.getPath(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (next == null || !PACKAGE_ID.equals(next.packageName) || next.getLongVersionCode() != expectedVersion
                    || next.getLongVersionCode() <= current.getLongVersionCode()) {
                return refused("APK package or version");
            }
            Signature installed = singleSigner(current);
            Signature candidate = singleSigner(next);
            if (installed == null || candidate == null || !MessageDigest.isEqual(installed.toByteArray(), candidate.toByteArray())
                    || !expectedCertificate.equals(fingerprint(candidate))) {
                return refused("APK signed identity");
            }
            if (!pm.canRequestPackageInstalls()) {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.fromParts("package", PACKAGE_ID, null)));
                return 1;
            }
            Uri uri = FileProvider.getUriForFile(activity, PACKAGE_ID + ".verifiedupdates", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);
            return 0;
        } catch (Exception error) {
            return refused(error.getClass().getSimpleName());
        }
    }

    private static Signature singleSigner(PackageInfo info) {
        if (info.signingInfo == null || info.signingInfo.hasMultipleSigners()) return null;
        Signature[] signers = info.signingInfo.getApkContentsSigners();
        return signers != null && signers.length == 1 ? signers[0] : null;
    }

    private static String fingerprint(Signature signature) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(signature.toByteArray());
        char[] hex = "0123456789abcdef".toCharArray();
        StringBuilder text = new StringBuilder(64);
        for (byte b : hash) text.append(hex[(b & 255) >>> 4]).append(hex[b & 15]);
        return text.toString();
    }

    private static int refused(String reason) {
        Log.w(NAME, "Blocked public update: " + reason);
        return 2;
    }
}
