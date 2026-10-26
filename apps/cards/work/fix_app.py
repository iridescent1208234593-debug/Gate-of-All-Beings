content = open(r'E:\zszm\src\App.tsx', 'r', encoding='utf-8').read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if '{currentPhaseConfig?.label' in line:
        indent = '                '
        new_line = indent + 'const currentPhaseConfig = PHASES.find(p => p.name === gatheringPhase);'
        lines.insert(i, new_line)
        break

content = '\n'.join(lines)
open(r'E:\zszm\src\App.tsx', 'w', encoding='utf-8').write(content)
print('Fixed currentPhaseConfig')
