export const generateTestText = (charCount) => {
  const loremRussian = `Проблема скролла в textarea - это известная проблема React приложений. 
При редактировании больших текстов скролл сбрасывается наверх при каждом изменении.
Это происходит из-за перерендера компонента и потери состояния DOM элемента.
Решение заключается в сохранении позиции скролла и восстановлении её после обновления.
useLayoutEffect выполняется синхронно после изменения DOM но перед отрисовкой браузером.
Это позволяет восстановить позицию скролла без видимого мерцания для пользователя.
Также важно сохранять позицию курсора через selectionStart и selectionEnd.
Для больших текстов можно добавить оптимизации через debounce и requestAnimationFrame.
`;

  const loremEnglish = `The textarea scroll issue is a well-known problem in React applications.
When editing large texts, the scroll position resets to the top on every change.
This happens due to component re-rendering and loss of DOM element state.
The solution involves saving the scroll position and restoring it after updates.
useLayoutEffect runs synchronously after DOM mutations but before browser paint.
This allows restoring scroll position without visible flickering to the user.
It's also important to save cursor position via selectionStart and selectionEnd.
For large texts, optimizations can be added through debounce and requestAnimationFrame.
`;

  const codeExample = `// Пример кода для тестирования подсветки и производительности
function useScrollPreservingTextarea(initialValue = '') {
  const [value, setValue] = useState(initialValue);
  const textAreaRef = useRef(null);
  const preservedStateRef = useRef({
    cursor: 0,
    scrollTop: 0
  });

  useLayoutEffect(() => {
    const textArea = textAreaRef.current;
    const preserved = preservedStateRef.current;
    
    if (textArea) {
      textArea.setSelectionRange(preserved.cursor, preserved.cursor);
      textArea.scrollTop = preserved.scrollTop;
    }
  }, [value]);

  return { value, setValue, textAreaRef };
}
`;

  const blocks = [loremRussian, loremEnglish, codeExample];
  let result = '';
  let currentLength = 0;

  while (currentLength < charCount) {
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    result += block + '\n\n';
    currentLength += block.length + 2;
  }

  // Обрезаем до нужной длины
  if (result.length > charCount) {
    result = result.substring(0, charCount);
  }

  return result;
};

export const generateStructuredText = (lineCount) => {
  const lines = [];
  for (let i = 1; i <= lineCount; i++) {
    lines.push(`Строка ${i}: Это тестовая строка для проверки производительности скролла и рендеринга в больших текстовых полях.`);
  }
  return lines.join('\n');
};

export const generateMarkdown = (sectionCount) => {
  let markdown = '# Тестовый Markdown документ\n\n';
  
  for (let i = 1; i <= sectionCount; i++) {
    markdown += `## Секция ${i}\n\n`;
    markdown += `Это параграф в секции ${i}. Здесь может быть много текста для тестирования.\n\n`;
    markdown += `- Пункт списка 1\n`;
    markdown += `- Пункт списка 2\n`;
    markdown += `- Пункт списка 3\n\n`;
    markdown += `\`\`\`javascript\n`;
    markdown += `// Код в секции ${i}\n`;
    markdown += `console.log('Section ${i}');\n`;
    markdown += `\`\`\`\n\n`;
  }
  
  return markdown;
};