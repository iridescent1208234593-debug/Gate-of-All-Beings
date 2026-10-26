// Generated from zszm_data_export.json (CloudBase single-file export).
export interface ZszmItemDef {
  name: string;
  icon: string;
  heal?: number;
  sellPrice?: number;
  imgId?: number;
  attackBonus?: number;
  attackBonusPercent?: number;
  target?: string;
  tool?: string;
  enchantable?: boolean;
  satiation?: number;
  foodEffect?: string;
}
export interface ZszmAvatarCat {
  key: string;
  label: string;
  start: number;
  end: number;
  optional: boolean;
  extra?: number[];
}
export interface ZszmCookRecipe {
  ingredients: Record<string, number>;
  time: number;
  result: string;
  label: string;
  catchAll?: boolean;
}
export interface ZszmCraftRecipe {
  output: string;
  label: string;
  inputCount: number;
  outputCount: number;
}
export interface ZszmAchievement {
  id: string;
  icon: string;
  desc: string;
  name: string;
}
declare const data: {
  schemaVersion: 1;
  source: string;
  itemDefs: Record<string, ZszmItemDef>;
  avatarCats: ZszmAvatarCat[];
  creatureTypes: string[];
  cookRecipes: Record<string, ZszmCookRecipe>;
  craftRecipes: Record<string, ZszmCraftRecipe[]>;
  achievements: ZszmAchievement[];
};
export default data;
