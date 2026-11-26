package com.godot.game;

import android.content.Context;
import android.content.SharedPreferences;

import org.godotengine.godot.Godot;
import org.godotengine.godot.plugin.GodotPlugin;
import org.godotengine.godot.plugin.SignalInfo;
import org.godotengine.godot.plugin.UsedByGodot;

import java.util.HashSet;
import java.util.Set;

/**
 * 把 OtaUpdater 的静态能力暴露给 GDScript。
 *
 * 用法（scripts/ota.gd）：
 *   Engine.get_singleton("JavaClassWrapper") 不行时，走这个 plugin 的 Java 类名反射；
 *   实际上 GDScript 通过 JavaClassWrapper.wrap("com.godot.game.OtaUpdater") 直接调静态方法，
 *   这个 plugin 只负责把 Godot 实例和 Activity 交出去，并提供两个便捷入口。
 *
 * 信号：
 *   ota_result(code:int, message:String)
 */
public class OtaPlugin extends GodotPlugin {
    private static final String TAG = "LAB-OTA";

    public OtaPlugin(Godot godot) {
        super(godot);
    }

    @Override
    public String getPluginName() {
        return "LabOta";
    }

    @Override
    public Set<SignalInfo> getPluginSignals() {
        Set<SignalInfo> signals = new HashSet<>();
        signals.add(new SignalInfo("ota_result", Integer.class, String.class));
        return signals;
    }

    @UsedByGodot
    public int getVersionCode() {
        Context ctx = getContext();
        return ctx == null ? 0 : OtaUpdater.versionCode(ctx);
    }

    @UsedByGodot
    public String getVersionName() {
        Context ctx = getContext();
        return ctx == null ? "" : OtaUpdater.versionName(ctx);
    }

    @UsedByGodot
    public boolean canInstall() {
        Context ctx = getContext();
        return ctx != null && OtaUpdater.canInstall(ctx);
    }

    @UsedByGodot
    public void openInstallSettings() {
        if (getActivity() != null) {
            OtaUpdater.openInstallSettings(getActivity());
        }
    }

    @UsedByGodot
    public boolean startDownload(String url, String sha256, String fileName) {
        Context ctx = getContext();
        return ctx != null && OtaUpdater.start(ctx, url, sha256, fileName);
    }

    @UsedByGodot
    public int progress() {
        Context ctx = getContext();
        return ctx == null ? OtaUpdater.STATE_FAILED : OtaUpdater.progress(ctx);
    }

    @UsedByGodot
    public boolean verify() {
        Context ctx = getContext();
        return ctx != null && OtaUpdater.verify(ctx);
    }

    @UsedByGodot
    public int install() {
        if (getActivity() == null) {
            return OtaUpdater.STATE_FAILED;
        }
        return OtaUpdater.install(getActivity());
    }

    @UsedByGodot
    public void clear() {
        Context ctx = getContext();
        if (ctx != null) {
            OtaUpdater.clear(ctx);
        }
    }

    @UsedByGodot
    public String lastError() {
        return OtaUpdater.lastError();
    }
}
