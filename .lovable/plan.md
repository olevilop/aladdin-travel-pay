Сделать имя файла в компоненте FileBlock кликабельным.

Технические детали:
- В src/components/file-block.tsx обернуть имя файла (текст внутри `<p className="truncate text-sm font-medium text-foreground">{f.name}</p>`) в интерактивный элемент (например, `<button>` или обработчик `onClick` на родительском `<div>`).
- По клику вызывать ту же функцию `onDownload(f)`, которая уже используется для кнопки «Скачать».
- Добавить визуальные подсказки: `cursor-pointer`, `hover:underline`, возможно `hover:text-primary`.
- Никаких других изменений не требуется.