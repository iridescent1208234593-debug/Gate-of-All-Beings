import sqlite3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from storage_paths import data_root, require_ready

require_ready()
DB_PATH = str(data_root() / 'worldview' / 'worldview_luoxiaohei_v4.db')

def get_tables():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables

def get_lifecycle_entries():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM spirit_lifecycle ORDER BY id')
    cols = [d[0] for d in cursor.description]
    rows = []
    for row in cursor.fetchall():
        rows.append(dict(zip(cols, row)))
    conn.close()
    return rows

def add_lifecycle_entry(data):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO spirit_lifecycle (category, term, definition, detailed_description, source_episodes, source_pages, animation_notes, related_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['category'], data['term'], data['definition'], data['detailed_description'],
          data['source_episodes'], data['source_pages'], data['animation_notes'], data['related_terms']))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def add_image_entry(lifecycle_id, image_path, description, image_type, source_url=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO spirit_lifecycle_images (lifecycle_id, image_path, image_description, image_type, source_url)
        VALUES (?, ?, ?, ?, ?)
    ''', (lifecycle_id, image_path, description, image_type, source_url))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: db_query.py <command>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'tables':
        for t in get_tables():
            print(t)

    elif cmd == 'list':
        entries = get_lifecycle_entries()
        for e in entries:
            print(f"{e['id']:3d} | {e['category']:20s} | {e['term']}")

    elif cmd == 'add_forest_env':
        data = {
            'category': '环境条件',
            'term': '森林聚灵环境',
            'definition': '妖精聚灵诞生所需的特定自然环境条件，包括人迹罕至、生灵种类数量充足、物质灵活跃等要素。',
            'detailed_description': '聚灵是极为苛刻的自然过程，只有在满足特定条件的原始森林中才能发生。\n\n必要条件：\n1. 人迹罕至：人类活动会干扰灵的流动，只有远离人类文明的深山老林才具备聚灵的基础条件。\n2. 生灵种类与数量充足：森林中必须拥有丰富的生物多样性——各种植物、动物共同构成复杂的生灵网络。\n3. 物质灵活跃：大地深处的物质灵需要足够活跃，能够自然上升至地表参与编织。\n4. 漫长时间：聚灵不是一朝一夕的过程，而是数十年甚至数百年的缓慢积累。\n\n环境特征：\n- 森林保存完好，没有大规模人为破坏\n- 植被层次丰富：地被层→灌木层→乔木层→冠层\n- 空气湿润，有溪流或水源\n- 地面覆盖厚厚的落叶层和苔藓\n- 光线柔和，林间有自然的光斑和阴影\n\n这些条件使得聚灵在现代社会几乎不可能发生——随着人类文明的扩张，适合聚灵的原始森林越来越少。这也是妖精数量持续减少的原因之一。',
            'source_episodes': '电影番外漫画第3话(聚灵)、蓝溪镇漫画第15话(谈心)、第68话(生灵)',
            'source_pages': '聚灵.md、妖精.md、灵.md',
            'animation_notes': '森林聚灵环境视觉设计规范：\n\n场景基础：\n- 原始森林地面视角，镜头高度约0.5-1.5米（小动物视角）\n- 植被层次：地面苔藓层(深绿 #1a2e1a)→蕨类植物(橄榄绿 #4a6a2a)→低矮灌木(暗绿 #2a4a1a)→乔木树干(深褐 #1a1008)→树冠(过滤光斑)\n\n环境光效：\n- 主光源：月光从树冠缝隙洒落，形成柔和的光柱（体积光效果）\n- 辅光源：生灵粒子本身的微弱辉光\n- 色温：整体偏冷（蓝绿调），但生灵/物质灵粒子偏暖\n\n地面细节：\n- 苔藓覆盖岩石和树根\n- 蕨类植物轻微摇曳（微风效果）\n- 落叶层（部分已分解为腐殖质）\n- 小型蘑菇/菌类（带微弱荧光）\n\n关键约束：\n- 不能有任何人造物的痕迹\n- 必须给人"原始""古老""宁静"的感觉\n- 光线要柔和自然，不能有人工光源的锐利感',
            'related_terms': '聚灵,生灵,物质灵,妖精,灵'
        }
        new_id = add_lifecycle_entry(data)
        print(f"Added forest environment entry with ID={new_id}")

    elif cmd == 'add_tianhu':
        data = {
            'category': '妖精实例',
            'term': '天虎聚灵特征',
            'definition': '天虎是在龙游森林中聚灵诞生的虎形妖精，是原作中展示聚灵过程的核心案例。',
            'detailed_description': '天虎是罗小黑战记中通过聚灵诞生的妖精之一，在原作电影番外漫画第3话《聚灵》中有详细描述。\n\n基本信息：\n- 诞生地点：龙游森林（一片保存完好的原始森林）\n- 外形特征：圆润可爱的虎形妖精，体型较小，身体圆滚滚的\n- 性格特征：温和、安静，与风息等人关系友好\n\n聚灵过程特征：\n- 天虎的聚灵发生在龙游森林深处，是自然环境长期孕育的结果\n- 生灵从森林各处汇聚，经过漫长的时间形成精灵\n- 精灵与物质灵结合后逐渐凝聚成虎形的实体\n- 风息、洛竹、虚淮等妖精在场围观了天虎的聚灵诞生\n\n天虎形态设计要点：\n- 整体轮廓：圆润紧凑，没有尖锐的棱角\n- 头部：大而圆，比例偏大（Q版感）\n- 耳朵：三角形的猫耳/虎耳，竖立在头顶\n- 眼睛：大而明亮的圆眼，奶油白色(#fdfae4)发光\n- 身体：圆滚滚的，四肢短粗\n- 尾巴：弯曲的尾巴，末端可能略粗\n- 体色：以暖色调为主，与物质灵的金色调相近\n- 体型：小型妖精，大约和一只猫差不多',
            'source_episodes': '电影番外漫画第3话(聚灵)、罗小黑战记电影(2019)',
            'source_pages': '聚灵.md、天虎.md、妖精.md',
            'animation_notes': '天虎聚灵诞生动画视觉设计：\n\n天虎形态规格（基于原作参考图）：\n- 身体比例：头身比约1:1，整体呈椭圆形轮廓\n- 头部：大圆球，直径约为身体宽度的80%\n- 耳朵：两个三角形耳朵，高度约为头径的40%，微微向外倾斜\n- 眼睛：两个圆形发光眼，直径约为头径的15%，颜色#fdfae4（奶油白）\n- 身体：椭圆形主体\n- 四肢：四个短粗的圆柱形腿\n- 尾巴：使用CatmullRom曲线，从身体后部自然弯曲延伸\n- 整体颜色：暖金奶油色 #f5e8b8 到 柔和橙金 #e8d4a0\n\n诞生动画细节：\n- 聚灵最后阶段（emergence），精灵凝聚成球形光团\n- 光团逐渐实体化，轮廓从光球形变为圆润虎形\n- 眼睛最先清晰显现（两点明亮的奶油白光）\n- 然后是耳朵竖起、四肢成型、尾巴卷曲\n- 整体过程像从光雾中"凝结"出来，不是突然弹出\n- 诞生后有一个轻微的"落地"动作（四肢触地，身体微弹）\n- 诞生瞬间周围生灵粒子会有短暂的向外扩散（柔和的波纹，非爆炸）\n\n关键约束：\n- 天虎的形态必须圆润可爱，符合罗小黑战记的Q版画风\n- 不能有尖锐棱角或写实风格\n- 眼睛是最重要的识别特征，必须清晰可见',
            'related_terms': '聚灵,妖精,天虎,风息,洛竹,虚淮,龙游森林'
        }
        new_id = add_lifecycle_entry(data)
        print(f"Added tianhu entry with ID={new_id}")

    else:
        print(f"Unknown command: {cmd}")
