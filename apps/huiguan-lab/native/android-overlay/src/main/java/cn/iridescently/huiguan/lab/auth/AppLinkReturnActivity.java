package cn.iridescently.huiguan.lab.auth;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Delivers a fixed-domain browser grant to an already started, same-device flow. */
public final class AppLinkReturnActivity extends Activity {
    public static final String PREFS = "lab_public_app_link";
    public static final String EXPECTED_STATE = "expected_state";
    public static final String VALID_UNTIL = "valid_until_millis";
    public static final String CODE = "code";
    public static final String STATE = "state";
    private static final String TOKEN = "([A-Za-z0-9_-]{42}[AEIMQUYcgkosw048])";
    private static final Pattern CALLBACK = Pattern.compile(
        "\\Ahttps://pc-lab\\.iridescently\\.cn/account/native/android/callback#code="
        + TOKEN + "&state=" + TOKEN + "\\z");

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try { deliver(getIntent()); } finally { finish(); }
    }

    private void deliver(Intent incoming) {
        if (incoming == null || !Intent.ACTION_VIEW.equals(incoming.getAction())) return;
        String url = incoming.getDataString();
        if (url == null || url.length() > 190) return;
        Matcher m = CALLBACK.matcher(url);
        if (!m.matches()) return;
        SharedPreferences local = getSharedPreferences(PREFS, MODE_PRIVATE);
        long remaining = local.getLong(VALID_UNTIL, 0L) - System.currentTimeMillis();
        if (remaining <= 0 || remaining > 300000L) return;
        String expected = local.getString(EXPECTED_STATE, "");
        String responseState = m.group(2);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                responseState.getBytes(StandardCharsets.US_ASCII))) return;
        if (!local.edit().remove(EXPECTED_STATE).remove(VALID_UNTIL)
                .putString(CODE, m.group(1)).putString(STATE, responseState).commit()) return;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
    }
}
