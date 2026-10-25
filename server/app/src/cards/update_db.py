import sqlite3
import json
from datetime import datetime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from storage_paths import data_root, require_ready

require_ready()
database = data_root() / 'worldview' / 'worldview_luoxiaohei_v4.db'
conn = sqlite3.connect(database.as_uri() + '?mode=rw', uri=True)
cursor = conn.cursor()

# 1. Add special case entry: 风息化树 (Fengxi's tree transformation as unusual dispersal)
cursor.execute("""
INSERT INTO spirit_lifecycle (category, term, definition, detailed_description, source_episodes, source_pages, animation_notes, related_terms)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", (
    '特殊案例',
    '风息化树',
    '风息在龙游展开领域失败后，生灵散尽但并未完全消散，而是化为一片林木留在龙游，是散灵的特殊形态。',
    '风息是龙游最强的妖精，本体为长鬃毛的豹子，紫色眼睛，深紫色毛色。在电影高潮部分，风息展开领域试图覆盖龙游，被小黑和无限阻止。领域瓦解后，风息的灵质空间衰竭，生灵开始散灵。但他的散灵并非普通的完全消散——他的生灵在散出后并未飘向天空，而是沉降入大地，在龙游的地面上生根发芽，化为一小片林木。这片林木后来被称为"风息公园"，风息死去的地方之后也建成了妖灵会馆。这是一种极为罕见的散灵形态，暗示风息的魂灵极为强大，虽死犹存，生灵以树木的形式延续了生命。风息的故事体现了妖精对故土的执念，以及"回归"这一主题的深层含义——散灵不是彻底的消亡，而是以另一种形式回归自然。',
    '罗小黑战记电影(2019)高潮部分',
    '风息.md、散灵.md',
    '风息散灵动画视觉设计（特殊案例）：\n\n与标准散灵不同，风息化树的散灵过程：\n1. 领域崩塌：巨大的光幕碎裂如玻璃，光片缓缓飘落\n2. 身体消散：豹形身体从边缘开始化为翠绿色光粒子\n3. 生灵沉降：不同于普通散灵的向上飘散，风息的生灵光点向下沉降，如落叶归根\n4. 化树过程：光点接触地面后，地面生出绿色光纹，光纹向上延伸形成树干轮廓\n5. 林木成形：树干上长出枝叶，由光粒子构成的树逐渐实体化\n6. 静谧残留：一片安静的树林矗立，树冠间偶尔闪过微弱的灵光\n\n色彩体系：\n- 风息生灵：深紫色 #4a2d6e 和翠绿 #879f4c 交织\n- 化树过程：从紫色逐渐过渡到翠绿，最终为橄榄苔绿\n- 氛围：不是悲伤的消散，而是另一种形式的"活着"\n\n关键约束：向下而非向上的散灵方向，体现"回归大地"的意象',
    '散灵,风息,魂灵,灵质空间,领域,龙游,御灵系-木'
))
fengxi_id = cursor.lastrowid

# 2. Update the existing 散灵 entry (ID=7) with cross-reference to 风息化树
cursor.execute("""
UPDATE spirit_lifecycle 
SET related_terms = related_terms || ',风息化树,风息公园',
    animation_notes = animation_notes || '\n\n特殊案例参考：风息化树（见spirit_lifecycle ID=' || CAST(? AS TEXT) || '）——散灵方向向下而非向上，生灵化为林木而非飘散天际。这展示了魂灵强大者的特殊散灵形态。'
WHERE id = 7
""", (fengxi_id,))

# 3. Add the new entry about 精灵 to 散灵 relationship
cursor.execute("""
UPDATE spirit_lifecycle 
SET related_terms = related_terms || ',散灵'
WHERE term = '精灵' AND related_terms NOT LIKE '%散灵%'
""")

# 4. Add entry about 散灵 in the articles table
cursor.execute("""
INSERT OR REPLACE INTO articles (name, description)
VALUES ('散灵动画参考', '散灵是聚灵的逆过程：妖精死亡后生灵消散回归自然。标准散灵过程：身体渐透→生灵如蒲公英飘散→加速消融→光点升天→回归大地。特殊案例：风息化树——生灵向下沉降化为林木。详见spirit_lifecycle表ID=7和ID=13。')
""")

# 5. Create a new spirit_lifecycle_images entry for the dispersal animation reference
# First check if there's already a dispersal-related image
cursor.execute("SELECT * FROM spirit_lifecycle_images WHERE lifecycle_id = 7")
existing = cursor.fetchall()
if not existing:
    cursor.execute("""
    INSERT INTO spirit_lifecycle_images (lifecycle_id, image_path, image_description, image_type)
    VALUES (7, 'E:\\罗小黑战记数据库\\images\\风息化树_概念.png', '风息散灵化树的概念设计，展示生灵向下沉降化为林木的过程', 'concept')
    """)

# 6. Add a new article about the spirit lifecycle visual system
cursor.execute("""
INSERT OR REPLACE INTO articles (name, description)
VALUES ('妖精生命周期视觉系统', '妖精的完整生命周期：聚灵(诞生)→生存→散灵(死亡)。聚灵为生灵+物质灵汇聚成形，散灵为生灵消散回归自然。数据库spirit_lifecycle表记录了12个核心概念，包含详细的动画视觉设计规范。Three.js实现：SpiritGatheringScene.tsx(聚灵60秒6阶段)和SpiritDispersalScene.tsx(散灵60秒6阶段)。')
""")

conn.commit()

# Verify updates
print('=== Updated spirit_lifecycle entries ===')
cursor.execute("SELECT id, category, term FROM spirit_lifecycle ORDER BY id")
for row in cursor.fetchall():
    print(f"ID={row[0]}, Cat={row[1]}, Term={row[2]}")

print('\n=== spirit_lifecycle_images ===')
cursor.execute("SELECT * FROM spirit_lifecycle_images")
for row in cursor.fetchall():
    print(row)

print('\n=== articles about spirits ===')
cursor.execute("SELECT * FROM articles WHERE name LIKE '%灵%'")
for row in cursor.fetchall():
    print(row)

conn.close()
print('\nDatabase update complete!')
