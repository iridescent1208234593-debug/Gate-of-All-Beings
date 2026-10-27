# -*- coding: utf-8 -*-
"""把 characters.json 里的内联展示页 HTML 与 base64 图片外置成独立文件，
JSON 只保留元数据 + 引用，实现 10MB -> <1MB。
先把服务切到新代码（新代码读 html_ref / 图片 URL，旧代码只读内联 html），
运行本脚本时要停掉会馆服务：characters.json 只能有一个写入进程，服务运行期间
另起进程整份写回会覆盖这段时间里用户的保存。
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

    def externalize(data):
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
        return moved_html, moved_img

    moved_html, moved_img = S.update_data(externalize)

    print(f"外置展示页 {moved_html} 个、图片 {moved_img} 张")
    print("characters.json 现在: %.1f KB" % (os.path.getsize(src) / 1024))


if __name__ == "__main__":
    main()
