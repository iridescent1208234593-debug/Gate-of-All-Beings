# -*- coding: utf-8 -*-
"""把 characters.json 里的内联展示页 HTML 与 base64 图片外置成独立文件，
JSON 只保留元数据 + 引用，实现 10MB -> <1MB。
务必在【新代码的服务器】启动后运行（新代码读 html_ref / 图片 URL，旧代码只读内联 html）。
幂等：可重复运行，已外置的自动跳过。运行前自动备份。"""
import os
import shutil
import time

import server_huiguan as S


def main():
    src = S.DATA_FILE
    bak = src + ".bak_" + time.strftime("%Y%m%d_%H%M%S")
    shutil.copy2(src, bak)
    print("备份:", bak)

    data = S.load_data()
    moved_html = moved_img = 0
    for owner, chars in data.items():
        for rec in chars:
            # 展示页 HTML 外置
            if rec.get("html"):
                ref = S.store_showcase_html(rec["html"])
                rec["html_ref"] = ref
                del rec["html"]
                moved_html += 1
            # 图片外置
            d = rec.get("data") or {}
            if d.get("image", "").startswith("data:"):
                d["image"] = S.store_data_uri(d["image"]); moved_img += 1
            if isinstance(d.get("images"), list):
                d["images"] = [S.store_data_uri(x) for x in d["images"]]
                moved_img += len(d["images"])
    S.save_data(data)

    print(f"外置展示页 {moved_html} 个、图片 {moved_img} 张")
    print("characters.json 现在: %.1f KB" % (os.path.getsize(src) / 1024))


if __name__ == "__main__":
    main()
