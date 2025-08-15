import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Layout configuration constants (same as in notes.service.ts)
const LAYOUT_CONFIG = {
  columnWidth: 180,
  columnSpacing: 50,
  rowHeight: 50,  // Уменьшено в 3 раза для компактности
  rowSpacing: 15, // Уменьшен интервал между карточками
  startX: 100,
  startY: 120,
  headerY: 50,
};

@Injectable()
export class MockDataService {
  constructor(private prisma: PrismaService) {}

  // Массивы для генерации осмысленного контента
  private readonly titles = [
    'Архитектура микросервисов',
    'Психология разработчика',
    'Рефакторинг легаси кода',
    'Эмоциональное выгорание в IT',
    'Принципы SOLID на практике',
    'Управление техническим долгом',
    'Code Review как искусство',
    'Soft skills для программиста',
    'Дизайн паттерны в современной разработке',
    'Баланс между работой и жизнью',
    'Тестирование как философия',
    'Ментальное здоровье в стартапе',
    'Clean Code на реальных проектах',
    'Синдром самозванца в IT',
    'Continuous Integration и DevOps',
    'Командная работа в распределенной команде',
    'Техники продуктивности для разработчика',
    'Миграция на новый стек технологий',
    'Психология код-ревью',
    'Документирование как навык',
  ];

  private readonly contentTemplates = [
    `Сегодня размышлял о {topic}. Это действительно важная тема в современной разработке. 

Основные моменты, которые стоит учитывать:
1. Необходимость постоянного обучения и адаптации к новым технологиям
2. Важность коммуникации внутри команды и с заказчиками
3. Баланс между скоростью разработки и качеством кода

{details}

В конечном итоге, главное - это найти правильный баланс между техническими навыками и soft skills. Только так можно стать по-настоящему эффективным разработчиком.`,

    `Интересное наблюдение про {topic}. После нескольких лет в индустрии понимаешь, что технологии - это только инструменты.

{details}

Самое важное - это умение решать проблемы и находить оптимальные решения. Технологии приходят и уходят, но фундаментальные принципы остаются неизменными. Важно развивать критическое мышление и способность к анализу.`,

    `Работая над текущим проектом, столкнулся с вопросом {topic}. Это заставило меня переосмыслить подход к разработке.

{details}

Каждый проект учит чему-то новому. Важно не просто писать код, но и понимать бизнес-логику, думать о пользователях и учитывать долгосрочную перспективу. Только так можно создавать действительно качественные продукты.`,
  ];

  private readonly details = [
    'Практика показывает, что самые элегантные решения часто оказываются самыми простыми. Не нужно усложнять там, где можно обойтись базовыми подходами. KISS принцип работает практически всегда.',
    'Интересно наблюдать, как меняется подход к разработке с опытом. Раньше хотелось использовать все новые технологии, теперь выбираю проверенные и стабильные решения. Зрелость приходит с опытом.',
    'Командная работа - это не просто разделение задач. Это постоянный обмен знаниями, взаимная поддержка и общее видение цели. Без этого даже самая талантливая команда не сможет работать эффективно.',
    'Тестирование - это не просто проверка кода. Это способ мышления, который помогает писать более качественный и поддерживаемый код с самого начала. TDD изменил мой подход к разработке.',
    'Документация - это инвестиция в будущее. Да, писать её скучно, но когда через полгода возвращаешься к своему коду, хорошая документация экономит часы времени.',
    'Рефакторинг - это не роскошь, а необходимость. Код живет и развивается, и если не уделять время его улучшению, технический долг растет экспоненциально.',
  ];

  private readonly tags = [
    ['разработка', 'архитектура'],
    ['психология', 'soft-skills'],
    ['рефакторинг', 'clean-code'],
    ['тестирование', 'качество'],
    ['продуктивность', 'тайм-менеджмент'],
    ['команда', 'коммуникация'],
    ['DevOps', 'CI/CD'],
    ['обучение', 'развитие'],
    ['проектирование', 'паттерны'],
    ['код-ревью', 'best-practices'],
  ];

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateContent(title: string): string {
    const template = this.getRandomElement(this.contentTemplates);
    const detail = this.getRandomElement(this.details);
    
    let content = template
      .replace('{topic}', title.toLowerCase())
      .replace('{details}', detail);
    
    // Добавляем дополнительный контент для достижения нужной длины
    const additionalContent = [
      '\n\nДополнительные размышления:\n',
      '• Важность постоянного обучения невозможно переоценить',
      '• Каждая ошибка - это возможность для роста',
      '• Код должен быть понятен не только машине, но и человеку',
      '• Оптимизация должна основываться на реальных метриках',
      '• Коммуникация решает больше проблем, чем технологии',
    ].join('\n');
    
    content += additionalContent;
    
    // Добавляем еще контента если нужно достичь минимальной длины
    while (content.length < 2000) {
      content += '\n\n' + this.getRandomElement(this.details);
    }
    
    // Обрезаем если слишком длинный
    if (content.length > 4000) {
      content = content.substring(0, 3997) + '...';
    }
    
    return content;
  }

  async generateWeekData(userId: string, startDate: Date) {
    // No user management needed - app is local
    const notes = [];
    
    // Объект для отслеживания Y позиций для каждой даты
    const yPositionsByDate = new Map();
    
    // Генерируем данные на 7 дней НАЗАД от текущей даты
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() - dayOffset); // Вычитаем дни, чтобы идти назад
      currentDate.setHours(0, 0, 0, 0); // Обнуляем время
      
      // Генерируем от 3 до 10 заметок на день
      const notesCount = this.getRandomInt(3, 10);
      
      // Начальная Y позиция для этой даты
      let currentY = LAYOUT_CONFIG.startY;
      
      for (let i = 0; i < notesCount; i++) {
        const title = this.getRandomElement(this.titles) + ' - День ' + (7 - dayOffset);
        const content = this.generateContent(title);
        const tags = this.getRandomElement(this.tags);
        
        // X координата = 0, frontend сам вычислит на основе даты
        // Y координата вычисляется последовательно для столбика
        const x = 0;
        const y = currentY;
        
        // Увеличиваем Y для следующей заметки в столбике
        currentY += LAYOUT_CONFIG.rowHeight + LAYOUT_CONFIG.rowSpacing;
        
        notes.push({
          userId,
          title,
          content,
          type: 'text',
          date: currentDate,
          x,
          y,
          tags,
          isArchived: false,
          isPinned: false,
          manuallyPositioned: false,
        });
      }
    }
    
    // Создаем все заметки в БД
    const createdNotes = await this.prisma.note.createMany({
      data: notes,
    });
    
    console.log(`🎲 [MockData] Создано ${notes.length} тестовых заметок на неделю`);
    
    return {
      success: true,
      count: notes.length,
      startDate,
      endDate: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000),
    };
  }

  async clearMockData(userId: string) {
    // Удаляем все заметки пользователя с пометкой в заголовке "День"
    const result = await this.prisma.note.deleteMany({
      where: {
        userId,
        title: {
          contains: '- День',
        },
      },
    });
    
    console.log(`🗑️ [MockData] Удалено ${result.count} тестовых заметок`);
    
    return {
      success: true,
      deletedCount: result.count,
    };
  }
}