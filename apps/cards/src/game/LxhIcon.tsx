import '@lxh/shared-ui/lxh-ui.js';
type SharedUI={ICONS:Record<string,string>};
export function LxhIcon({name}:{name:string}) {
  const ui=(window as unknown as {LXHUI:SharedUI}).LXHUI;
  return <span className="lxh-shared-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:ui.ICONS[name]||ui.ICONS.star}}/>;
}
