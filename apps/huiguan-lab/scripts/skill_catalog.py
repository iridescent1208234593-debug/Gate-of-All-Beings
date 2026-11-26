"""Builds client/data/skills.json, the skill tree shared by the LAB client and server.

Source: the PixelFX catalog (MIT, patch-gg/pixelfx + winkidney/pixelfx-godot), read-only from the asset library.
Each of the 21 effect categories is one branch. Inside a branch the effects are ordered from small to large
(canvas area x duration) and cut into tiers of three; a skill in tier N needs any unlocked skill of tier N-1
in the same branch and costs N points.

    server/.venv/Scripts/python.exe scripts/skill_catalog.py [path/to/CATALOG.md]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = Path(r"E:\资产\特效\PixelFX资源包\01_特效资源\00-索引\CATALOG.md")
OUT = LAB / "client" / "data" / "skills.json"
TIER_SIZE = 3

# branch id -> (中文名, 一句话, 播放方式)
#   anchor "front": in front of the caster, flipped with facing; "self": centred on the caster;
#   "screen": full-screen overlay (weather: everyone near the caster; transitions: the caster only)
BRANCHES = {
    "melee": ("近战", "刀光与拳风", "front"),
    "moves": ("招式", "完整的出招动作", "front"),
    "impacts": ("冲击", "命中瞬间的火花", "front"),
    "projectiles": ("弹道", "飞出去的东西", "front"),
    "fire": ("火焰", "炬火、吐息与烈焰", "front"),
    "ice": ("冰霜", "冰枪、冰刺与霜环", "front"),
    "lightning": ("雷电", "电弧、落雷与雷暴", "front"),
    "water": ("水流", "水球、喷泉与浪涌", "front"),
    "nature": ("自然", "藤蔓、岩刺与孢子", "front"),
    "arcane": ("奥术", "法阵、传送与星落", "self"),
    "holy": ("神圣", "治愈、光柱与圣盾", "self"),
    "shadow": ("暗影", "诅咒、黑洞与亡魂", "self"),
    "explosions": ("爆破", "从小爆竹到核爆", "front"),
    "scifi": ("科幻", "力场、全息与跃迁", "self"),
    "status": ("状态", "头顶的状态标记", "self"),
    "spawn": ("出入场", "登场与谢幕", "self"),
    "pickups": ("宝物", "金币、宝石与宝箱", "self"),
    "ui": ("提示", "飘字、升级与成就", "self"),
    "critters": ("灵宠", "召唤小动物陪你一会儿", "self"),
    "weather": ("天象", "改变身边的天气", "screen"),
    "transitions": ("转场", "只在自己屏幕上的镜头转场", "screen"),
}

NAMES = {
    "moves/arrow-shot": "张弓射箭", "moves/dash-strike": "突进斩", "moves/earth-stomp": "震地践踏",
    "moves/fireball-throw": "投掷火球", "moves/ground-pound": "腾跃重击", "moves/holy-smite": "圣光裁决",
    "moves/ice-lance-throw": "掷冰枪", "moves/lightning-call": "引雷", "moves/meteor-call": "召唤陨石",
    "moves/pistol-shots": "三连射", "moves/rocket-launcher": "火箭筒", "moves/sword-combo": "三段剑舞",
    "fire/brazier": "火盆", "fire/campfire": "篝火", "fire/candle": "烛火", "fire/fire-breath": "火焰吐息",
    "fire/fire-ring": "火环", "fire/fire-tornado": "火焰旋风", "fire/fireball": "火球", "fire/flame-pillar": "炎柱",
    "fire/flamethrower": "喷火", "fire/meteor": "陨石", "fire/spirit-flame": "灵火", "fire/torch": "火把",
    "explosions/barrel-explosion": "炸药桶", "explosions/big-explosion": "大爆炸", "explosions/cartoon-pow": "砰！",
    "explosions/dirt-explosion": "尘土爆", "explosions/firework-burst": "烟花绽放", "explosions/firework-rocket": "烟花升空",
    "explosions/grenade": "手雷", "explosions/implosion": "内爆", "explosions/nuke": "核爆",
    "explosions/plasma-explosion": "等离子爆", "explosions/small-explosion": "爆炸", "explosions/smoke-bomb": "烟雾弹",
    "water/bubbles": "泡泡", "water/drip": "水滴", "water/fountain": "喷泉", "water/geyser": "间歇泉",
    "water/rain-splash": "雨溅", "water/ripples": "涟漪", "water/splash": "水花", "water/water-jet": "水柱",
    "water/water-orb": "水球", "water/waterfall": "瀑布", "water/wave-crash": "浪涌", "water/whirlpool": "漩涡",
    "ice/blizzard-vortex": "暴雪漩涡", "ice/freeze": "冰封", "ice/frost-breath": "寒霜吐息", "ice/frost-nova": "霜之新星",
    "ice/ice-crystal": "冰晶", "ice/ice-lance": "冰枪", "ice/ice-shatter": "碎冰", "ice/ice-spikes": "冰刺",
    "ice/icicle-fall": "冰锥坠落", "ice/snowflake-burst": "雪花迸散",
    "lightning/ball-lightning": "球状闪电", "lightning/chain-lightning": "闪电链", "lightning/charge-up": "蓄电",
    "lightning/electrified": "带电", "lightning/lightning-strike": "落雷", "lightning/plasma-ball": "等离子球",
    "lightning/spark-arc": "电弧", "lightning/storm-cloud": "雷云", "lightning/tesla-coil": "特斯拉线圈",
    "lightning/thunderclap": "雷鸣", "lightning/zap-hit": "电击",
    "scifi/emp-blast": "电磁脉冲", "scifi/energy-core": "能量核心", "scifi/force-field": "力场",
    "scifi/glitch": "故障", "scifi/hologram": "全息投影", "scifi/jetpack": "喷气背包", "scifi/laser-grid": "激光网",
    "scifi/scanner": "扫描", "scifi/teleporter-pad": "传送台", "scifi/tractor-beam": "牵引光束",
    "scifi/warp-in": "跃迁登场", "scifi/warp-out": "跃迁离场",
    "melee/claw-swipe": "爪击", "melee/dagger-flurry": "匕首乱舞", "melee/double-slash": "双斩",
    "melee/hammer-smash": "锤击", "melee/heavy-cleave": "重劈", "melee/scythe-reap": "镰刀收割",
    "melee/spear-sweep": "横扫枪", "melee/spin-slash": "回旋斩", "melee/sword-slash": "斩击", "melee/thrust": "突刺",
    "melee/uppercut": "上勾拳", "melee/whip-crack": "鞭击",
    "impacts/blunt-hit": "钝击", "impacts/bullet-impact": "弹着点", "impacts/crit-hit": "暴击",
    "impacts/ground-slam": "地面猛击", "impacts/heavy-landing": "重落地", "impacts/hit-flash": "受击闪光",
    "impacts/hit-spark": "命中火花", "impacts/impact-frame": "冲击帧", "impacts/parry": "格挡反击",
    "impacts/ricochet": "跳弹", "impacts/shield-block": "盾挡",
    "projectiles/arrow": "飞箭", "projectiles/bullet-tracer": "曳光弹", "projectiles/cannonball": "炮弹",
    "projectiles/energy-disc": "能量飞盘", "projectiles/flare": "信号弹", "projectiles/homing-missile": "追踪导弹",
    "projectiles/laser-bolt": "激光弹", "projectiles/magic-missile": "魔法飞弹", "projectiles/muzzle-pistol": "手枪",
    "projectiles/muzzle-shotgun": "霰弹", "projectiles/muzzle-smg": "冲锋枪", "projectiles/plasma-shot": "等离子弹",
    "projectiles/rocket": "火箭弹",
    "spawn/coin-drop": "掉落金币", "spawn/disintegrate": "瓦解", "spawn/dissolve-burn": "焚化",
    "spawn/egg-hatch": "破壳", "spawn/poof": "噗", "spawn/respawn-beam": "复活光柱", "spawn/shatter-death": "碎裂",
    "spawn/soul-rise": "魂升", "spawn/spawn-portal": "出生门", "spawn/summon-rise": "召唤升起",
    "arcane/arcane-beam": "奥术射线", "arcane/arcane-missiles": "奥术飞弹", "arcane/arcane-orb": "奥术球",
    "arcane/blink-in": "闪现出现", "arcane/blink-out": "闪现消失", "arcane/magic-circle-cast": "法阵咏唱",
    "arcane/mana-burst": "魔力爆发", "arcane/portal": "传送门", "arcane/rune-circle": "符文环",
    "arcane/spell-charge": "蓄力", "arcane/star-fall": "星落", "arcane/time-stop": "时停",
    "holy/blessing": "祝福", "holy/divine-shield": "圣盾", "holy/feather-burst": "羽散", "holy/halo": "光环",
    "holy/heal": "治疗", "holy/heal-aoe": "治愈之环", "holy/holy-pillar": "圣光柱", "holy/resurrection": "复活",
    "holy/smite": "惩击", "holy/sunburst": "日耀",
    "shadow/black-hole": "黑洞", "shadow/curse": "诅咒", "shadow/dark-explosion": "暗爆", "shadow/eclipse": "日蚀",
    "shadow/grasping-hands": "冥手", "shadow/hex-sigil": "咒印", "shadow/life-steal": "生命汲取",
    "shadow/necro-skulls": "亡灵骷髅", "shadow/shadow-flames": "暗焰", "shadow/shadow-tendrils": "暗影触手",
    "shadow/soul-drain": "灵魂吸取", "shadow/void-orb": "虚空球",
    "status/bleeding": "流血", "status/burning": "燃烧", "status/charmed": "魅惑", "status/confused": "混乱",
    "status/cursed": "受诅", "status/frozen": "冻结", "status/haste": "加速", "status/petrified": "石化",
    "status/poisoned": "中毒", "status/rage": "狂怒", "status/sleep": "睡眠", "status/slowed": "减速",
    "status/stunned": "眩晕",
    "nature/acid-splash": "酸液", "nature/boulder": "滚石", "nature/earth-spike": "地刺",
    "nature/healing-bloom": "愈花", "nature/leaf-storm": "落叶风暴", "nature/poison-cloud": "毒云",
    "nature/quake": "地震", "nature/root-snare": "根须缠绕", "nature/spore-burst": "孢子爆", "nature/thorns": "荆棘",
    "nature/tornado": "龙卷风", "nature/toxic-puddle": "毒潭", "nature/vine-whip": "藤鞭",
    "weather/aurora": "极光", "weather/blizzard": "暴风雪", "weather/cherry-blossoms": "樱吹雪", "weather/clouds": "流云",
    "weather/falling-leaves": "落叶", "weather/fireflies": "萤火", "weather/fog": "雾", "weather/god-rays": "丁达尔光",
    "weather/rain": "雨", "weather/shooting-stars": "流星雨", "weather/snow": "雪", "weather/storm": "雷暴",
    "ui/achievement": "成就达成", "ui/coin-collect": "收集金币", "ui/combo-counter": "连击数",
    "ui/confetti": "彩带", "ui/countdown": "倒计时", "ui/crit-number": "暴击数字", "ui/damage-number": "伤害数字",
    "ui/exclamation": "感叹号", "ui/health-bar-hit": "掉血条", "ui/heart-lost": "失去一颗心", "ui/level-up": "升级",
    "ui/quest-complete": "任务完成",
    "pickups/chest-open": "开宝箱", "pickups/coin-spin": "旋转金币", "pickups/collect-burst": "拾取闪光",
    "pickups/crystal-shard": "水晶碎片", "pickups/gem-spin": "宝石", "pickups/heart-pickup": "爱心",
    "pickups/key-glint": "钥匙", "pickups/loot-beam": "战利品光柱", "pickups/potion": "药水",
    "pickups/power-star": "无敌星", "pickups/xp-orb": "经验球",
    "transitions/blinds": "百叶窗", "transitions/burn-away": "焚尽", "transitions/crt-off": "关显像管",
    "transitions/diamond-wipe": "菱形擦除", "transitions/glitch-wipe": "故障擦除", "transitions/iris": "光圈",
    "transitions/pixel-dissolve": "像素溶解", "transitions/shatter-wipe": "碎屏", "transitions/slash-wipe": "斩屏",
    "transitions/star-iris": "星形光圈",
    "critters/bat": "蝙蝠", "critters/bird": "小鸟", "critters/butterfly": "蝴蝶", "critters/eyeball": "眼球怪",
    "critters/fish-school": "鱼群", "critters/flying-skull": "飞颅", "critters/frog": "青蛙", "critters/ghost": "幽灵",
    "critters/jellyfish": "水母", "critters/slime": "史莱姆", "critters/snake": "小蛇", "critters/wisp": "鬼火",
}

ROW = re.compile(r"^\| (?P<name>[^|]+?) \| `(?P<id>[a-z]+/[a-z0-9-]+)` \| (?P<kind>loop|one-shot) (?P<dur>[0-9.]+)s \| (?P<w>\d+)×(?P<h>\d+) \| (?P<desc>.*) \|$")


def main() -> None:
    catalog = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CATALOG
    rows = [m.groupdict() for m in map(ROW.match, catalog.read_text(encoding="utf-8").splitlines()) if m]
    by_branch: dict[str, list[dict]] = {b: [] for b in BRANCHES}
    for r in rows:
        by_branch[r["id"].split("/")[0]].append(r)
    missing = [r["id"] for r in rows if r["id"] not in NAMES]
    if missing:
        raise SystemExit(f"no 中文名 for: {missing}")
    branches, skills = [], {}
    for bid, (title, blurb, anchor) in BRANCHES.items():
        items = sorted(by_branch[bid], key=lambda r: (int(r["w"]) * int(r["h"]) * float(r["dur"]), r["id"]))
        ids = []
        for i, r in enumerate(items):
            tier = i // TIER_SIZE + 1
            loop = r["kind"] == "loop"
            dur = float(r["dur"])
            # loops play long enough to read (at least 3 s, at most 2 cycles past that); weather lingers
            play = min(12.0, max(3.0, dur * 2)) if loop else dur
            if bid == "weather":
                play = 10.0
            skills[r["id"]] = {
                "id": r["id"], "branch": bid, "name": NAMES[r["id"]], "en": r["name"], "desc": r["desc"],
                "tier": tier, "cost": tier, "loop": loop, "duration": dur, "play": round(play, 2),
                "cooldown": round(max(1.0, min(8.0, play)), 2), "size": [int(r["w"]), int(r["h"])], "anchor": anchor,
            }
            ids.append(r["id"])
        branches.append({"id": bid, "name": title, "blurb": blurb, "anchor": anchor, "skills": ids,
                         "tiers": (len(ids) + TIER_SIZE - 1) // TIER_SIZE})
    data = {
        "version": 1,
        "source": "PixelFX (MIT) patch-gg/pixelfx 044e12a, winkidney/pixelfx-godot babe913",
        "slots": 4, "tier_size": TIER_SIZE, "start_points": 10, "minutes_per_point": 10,
        "branches": branches, "skills": skills,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(skills)} skills in {len(branches)} branches -> {OUT}")


if __name__ == "__main__":
    main()
