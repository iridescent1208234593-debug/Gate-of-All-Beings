"""Resolve published gallery entities that are not saved OC HTML documents."""
from html import escape
import re


def document(title, content):
    return ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>' + escape(title) + '</title><style>'
            'body{margin:0;padding:24px;background:#f5f0e8;color:#3a4a3e;font:16px/1.8 system-ui}'
            '.page{max-width:960px;margin:auto}h1{font-size:24px}img{display:block;max-width:100%;height:auto;margin:16px auto}'
            'p{white-space:pre-wrap}button{font:inherit;padding:8px 16px;cursor:pointer}small{color:#657368}'
            '</style></head><body><main class="page"><h1>' + escape(title) + '</h1>' + content +
            '<button id="saveImgBtn" type="button">保存为图片</button></main></body></html>')


def image(source, title):
    if not re.fullmatch(r'/assets/uploads/[a-f0-9]{32,64}\.(?:png|jpg|webp|gif)', source or ''):
        return ''
    return '<img src="' + escape(source, quote=True) + '" alt="' + escape(title, quote=True) + '" decoding="async">'


def gallery_document(row, label, *, extra=""):
    title = row['name'] or row['code']
    fields = [('species', '种族'), ('gender', '性别'), ('faction', '阵营'), ('ability', '能力'),
              ('appearance', '外貌'), ('story', '故事')]
    details = ''.join('<p><strong>' + name + '</strong> ' + escape(str(row[key])) + '</p>'
                      for key, name in fields if row[key])
    return document(title, '<small>' + escape(label) + '</small>' + image(row['image_data'], title) + details + extra)


# Existing showcase form fields only. Never render raw stored HTML or identity metadata.
REVIEW_DETAIL_FIELDS = (
    ("age", "年龄"), ("height", "身高"), ("species_type", "物种类别"),
    ("org", "组织"), ("personality", "性格"), ("likes", "喜好"),
    ("dislikes", "不喜欢"), ("food", "饮食"), ("weapon", "武器"),
    ("intro", "简介"), ("notes", "备注"),
)


def gallery_review_document(row, data):
    if data is None:
        return gallery_document(row, "审核中的提交版本 · 未找到匹配的原设表，仅显示提交时保留的字段。")
    details = []
    for key, label in REVIEW_DETAIL_FIELDS:
        value = data.get(key)
        if key == "age" and value in (None, ""):
            value = data.get("ageNum")
        if isinstance(value, (str, int, float)) and not isinstance(value, bool) and str(value).strip():
            details.append("<p><strong>" + label + "</strong> " + escape(str(value)[:16384]) + "</p>")
    custom = data.get("customDetails")
    if isinstance(custom, dict):
        ability_details = [str(value)[:2048] for value in list(custom.values())[:32]
                           if isinstance(value, str) and value.strip()]
        if ability_details:
            details.append("<p><strong>能力补充</strong> " + escape("\n".join(ability_details)) + "</p>")
    if not details:
        return gallery_document(row, "审核中的提交版本 · 原设表未填写补充字段。")
    return gallery_document(row, "审核中的提交版本",
                            extra="<section><h2>原设表补充资料</h2>" + "".join(details) + "</section>")


def published_document(conn, code, ident=None):
    """Use the poster's own ID/visibility, or an explicitly public gallery snapshot."""
    match = re.fullmatch(r'poster-([1-9][0-9]{0,9})', code)
    if match:
        row = conn.execute('SELECT * FROM posters WHERE id=?', (int(match[1]),)).fetchone()
        if row is None:
            return None
        owner = ident and ident.get('kind') == row['user_kind'] and str(ident.get('uid')) == str(row['user_uid'])
        if not row['is_public'] and not owner:
            return None
        title = row['title'] or '配色海报'
        return document(title, image(row['img_ref'], title))
    # A public gallery record can outlive its original editable OC. Its published
    # fields remain real content; do not invent/recreate a missing private record.
    row = conn.execute("SELECT * FROM fan_characters WHERE code=? AND is_public=1 AND review_status='approved' AND type!='配色海报' ORDER BY id DESC LIMIT 1", (code,)).fetchone()
    if row is None:
        return None
    return gallery_document(row, '原始设表已不在当前资料中，以下为保留的已公开画廊资料。')
