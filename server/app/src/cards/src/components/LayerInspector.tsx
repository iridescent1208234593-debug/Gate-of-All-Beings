import React from 'react';
import { Eye, EyeOff, Layers, Sparkles, Box, TreePine, Smile } from 'lucide-react';

interface LayerInspectorProps {
  visibleLayers: {
    moon: boolean;
    creatures: boolean;
    bushes: boolean;
    gate: boolean;
    text: boolean;
  };
  onToggleLayer: (layerName: keyof LayerInspectorProps['visibleLayers']) => void;
  onResetLayers: () => void;
}

export const LayerInspector: React.FC<LayerInspectorProps> = ({
  visibleLayers,
  onToggleLayer,
  onResetLayers,
}) => {
  const layerList: {
    key: keyof LayerInspectorProps['visibleLayers'];
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      key: 'moon',
      label: '圆月与星光',
      icon: <Sparkles className="w-4 h-4 text-amber-300" />,
      description: '中央圆月及开场汇聚的星点',
    },
    {
      key: 'bushes',
      label: '植物与基座',
      icon: <TreePine className="w-4 h-4 text-emerald-400" />,
      description: '前后植物及菱形基座',
    },
    {
      key: 'creatures',
      label: '鹿灵、鲸灵与团子灵',
      icon: <Smile className="w-4 h-4 text-pink-300" />,
      description: '半透明轮廓、眼睛及身体细节',
    },
    {
      key: 'gate',
      label: '众生之门图形',
      icon: <Box className="w-4 h-4 text-indigo-400" />,
      description: '原片的几何中文标志与六边形点缀',
    },
    {
      key: 'text',
      label: '英文标志',
      icon: <Layers className="w-4 h-4 text-yellow-200" />,
      description: 'LIVING / ALL CREATURES 图形文字',
    },
  ];

  return (
    <div className="w-full qc-card">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="qc-h2">分层检查</h3>
        </div>
        <button
          onClick={onResetLayers}
          className="qc-btn qc-btn--ghost qc-btn--sm"
        >
          显示全部
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {layerList.map((layer) => {
          const isVisible = visibleLayers[layer.key];
          return (
            <button
              key={layer.key}
              aria-label={layer.label}
              aria-pressed={isVisible}
              onClick={() => onToggleLayer(layer.key)}
              className={`qc-btn qc-btn--ghost flex items-start gap-3 text-left ${isVisible?'':'opacity-50'}`}
            >
              <span className="mt-0.5" aria-hidden="true">
                {isVisible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-600" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {layer.icon}
                  <span className="truncate">{layer.label}</span>
                </span>
                <span className="qc-hint block">{layer.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
