content = open(r'E:\zszm\src\App.tsx', 'r', encoding='utf-8').read()

# Remove the incorrectly placed line
content = content.replace(
    '''                const currentPhaseConfig = PHASES.find(p => p.name === gatheringPhase);
                <span>''',
    '''                <span>'''
)

# Add the definition in the component body before the return statement
# Find the return statement and add it before
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'return (' in line and i > 100:  # Make sure it's the main return
        # Check if we're in the right component
        if i > 200:  # Should be in the main App component
            indent = '  '
            new_line = indent + 'const currentPhaseConfig = PHASES.find(p => p.name === gatheringPhase);'
            # Check if it's already defined
            if 'const currentPhaseConfig' not in content:
                lines.insert(i, new_line)
            break

content = '\n'.join(lines)
open(r'E:\zszm\src\App.tsx', 'w', encoding='utf-8').write(content)
print('Fixed currentPhaseConfig placement')
