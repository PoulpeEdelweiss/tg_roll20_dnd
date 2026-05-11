// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { getStartKeyboard, getDiceKeyboard, getBackKeyboard } = require('./handlers/keyboard');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const API_BASE = 'https://www.dnd5eapi.co/api';
const userState = {};

// =============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================================================

// Безопасное редактирование сообщений (игнорирует ошибку "message is not modified")
async function safeEdit(chatId, msgId, text, opts = {}) {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts });
  } catch (err) {
    if (err.response?.description?.includes('message is not modified')) return;
    console.error('Edit error:', err.message);
  }
}

// Форматирование заклинания
function formatSpell(spell) {
  const components = Array.isArray(spell.components) 
    ? spell.components.join(', ') 
    : (spell.components || '—');
    
  const classes = spell.classes?.length 
    ? spell.classes.map(c => c.name).join(', ') 
    : 'Нет';
    
  const desc = Array.isArray(spell.desc) && spell.desc.length > 0
    ? spell.desc[0]
    : (spell.desc || 'Описание отсутствует');

  return `✨ <b>${spell.name}</b> (Ур. ${spell.level ?? 0})
📖 Школа: ${spell.school?.name || '—'}
⏱ Время: ${spell.casting_time || '—'}
📏 Дальность: ${spell.range || '—'}
🔮 Компоненты: ${components}
⏳ Длительность: ${spell.duration || '—'}
👤 Классы: ${classes}

📜 ${desc}`;
}

// Форматирование деталей для разных категорий
function formatDetails(data, type) {
  switch (type) {
    case 'spells':
      return formatSpell(data);
      
    case 'classes': 
      return `⚔️ <b>${data.name}</b>\n${data.desc?.[0] || ''}\n🩸 Кубик хитов: d${data.hit_die || '—'}`;
      
    case 'races': 
      return `🧝 <b>${data.name}</b>\n${data.desc?.[0] || ''}\n📈 Бонусы: ${data.ability_bonuses?.map(b => `${b.ability_score?.name || b} +${b.bonus}`).join(', ') || 'Нет'}`;
      
    case 'monsters': 
      return `👹 <b>${data.name}</b>\n⚔️ CR: ${data.challenge_rating}\n❤️ HP: ${data.hit_points}\n🛡 AC: ${Array.isArray(data.armor_class) ? data.armor_class[0]?.value : data.armor_class}\n📖 Тип: ${data.type}`;
      
    case 'magic-items': 
      return `💎 <b>${data.name}</b>\n💠 Редкость: ${data.rarity?.name || 'Неизвестно'}\n\n${data.desc?.[0] || 'Описание отсутствует'}`;
      
    default: 
      return `📄 <b>${data.name}</b>\n<pre>${JSON.stringify(data, null, 2).slice(0, 500)}...</pre>`;
  }
}

// Бросок кубиков
function rollDice(expr) {
  const [count, sides] = expr.split('d').map(Number);
  const rolls = []; 
  let total = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r); 
    total += r;
  }
  return { total, rolls };
}

// =============================================================================
// ОСНОВНЫЕ ФУНКЦИИ ОТОБРАЖЕНИЯ
// =============================================================================

// Показ списка элементов категории с пагинацией
// Показ списка элементов категории с пагинацией
// Показ списка элементов категории с пагинацией
async function showList(chatId, msgId, title, endpoint, page) {
  try {
    const LIMIT = 10;
    
    // 1. Запрос к API (без параметров пагинации, так как API может их игнорировать)
    const res = await axios.get(`${API_BASE}/${endpoint}`);
    
    const allItems = Array.isArray(res.data.results) ? res.data.results : [];
    const totalCount = res.data.count ?? allItems.length;
    
    if (allItems.length === 0) {
      return bot.sendMessage(chatId, `📭 ${title}: элементы не найдены.`);
    }
    
    // 2. КЛИЕНТСКАЯ ПАГИНАЦИЯ: берём только нужные 10 элементов для текущей страницы
    const offset = (page - 1) * LIMIT;
    const items = allItems.slice(offset, offset + LIMIT);
    
    // 3. Формируем кнопки элементов
    // Каждая кнопка — это отдельная строка в массиве: [[{btn1}], [{btn2}], ...]
    const buttons = items.map(item => [{
      text: item.name,
      callback_data: `select__${endpoint}__${item.index}`
    }]);
    
    // 4. Кнопки пагинации
    const pagination = [];
    if (page > 1) {
      pagination.push({ 
        text: '⬅️ Назад', 
        callback_data: `page__${endpoint}__${page - 1}` 
      });
    }
    // Показываем "Вперёд", если есть ещё элементы после текущей страницы
    if (offset + LIMIT < totalCount) {
      pagination.push({ 
        text: 'Вперёд ➡️', 
        callback_data: `page__${endpoint}__${page + 1}` 
      });
    }
    
    // 5. Кнопка "В меню" — ПРАВИЛЬНАЯ СТРУКТУРА
    // backBtn — это уже массив (строка клавиатуры), поэтому не оборачиваем его ещё раз в []
    const backBtn = [{ text: '🔙 В меню', callback_data: 'back_to_main' }];
    
    // 6. Собираем клавиатуру
    const keyboard = {
      inline_keyboard: [
        ...buttons,                    // строки с элементами
        ...(pagination.length > 0 ? [pagination] : []), // строка с пагинацией (если есть)
        backBtn                        // строка с кнопкой "В меню"
      ]
    };
    
    const totalPages = Math.ceil(totalCount / LIMIT);
    const messageText = `📚 ${title} (стр. ${page} из ${totalPages}):\nВыберите элемент:`;
    
    // 7. Отправляем НОВОЕ сообщение (не редактируем старое)
    const sentMsg = await bot.sendMessage(chatId, messageText, { 
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
    
    // 8. Удаляем старое сообщение при переключении страниц, чтобы не было дублей
    if (msgId && page > 1) {
      bot.deleteMessage(chatId, msgId).catch(() => {});
    }
    
  } catch (err) {
    console.error(`[showList] ❌ ОШИБКА: ${endpoint} page ${page}:`, err.message);
    bot.sendMessage(chatId, `⚠️ Ошибка загрузки "${title}". Попробуйте позже.`);
  }
}

// Показ результатов поиска заклинаний (НОВАЯ ФУНКЦИЯ)
async function showSearchResults(chatId, query, results, page) {
  const PER_PAGE = 10;
  const start = (page - 1) * PER_PAGE;
  const pageResults = results.slice(start, start + PER_PAGE);
  const totalPages = Math.ceil(results.length / PER_PAGE);
  
  // Кнопки с названиями заклинаний
  const buttons = pageResults.map(spell => [{
    text: spell.name,
    callback_data: `search_select__spells__${spell.index}`
  }]);
  
  // Кнопки пагинации
  const pagination = [];
  if (page > 1) {
    pagination.push({ 
      text: '⬅️', 
      callback_data: `search_page__${page - 1}` 
    });
  }
  if (page < totalPages) {
    pagination.push({ 
      text: '➡️', 
      callback_data: `search_page__${page + 1}` 
    });
  }
  
  const keyboard = {
    inline_keyboard: [
      ...buttons,
      ...(pagination.length ? [pagination] : []),
      [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
    ]
  };
  
  const message = results.length === 1 
    ? `🔍 Найдено 1 заклинание по запросу "${query}":`
    : `🔍 Найдено ${results.length} заклинаний по запросу "${query}" (стр. ${page}/${totalPages}):`;
  
  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'HTML'
  });
}

// =============================================================================
// ОБРАБОТЧИКИ КОМАНД И СОБЫТИЙ
// =============================================================================

// Команда /start
bot.onText(/\/start/, (msg) => {
  userState[msg.chat.id] = { step: 'main' };
  bot.sendMessage(msg.chat.id, '🎲 Добро пожаловать в D&D 5e Bot!\nВыберите функцию:', {
    reply_markup: getStartKeyboard()
  });
});

// Команда /spell с аргументом (поиск)
bot.onText(/\/spell\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].trim().toLowerCase();
  
  await bot.sendChatAction(chatId, 'typing');
  
  try {
    // Получаем все заклинания (лимит 500 покрывает полный список)
    const allSpellsRes = await axios.get(`${API_BASE}/spells`, { 
      params: { limit: 500 }
    });
    
    // Фильтруем клиентски: частичное совпадение имени
    const filtered = allSpellsRes.data.results.filter(spell => 
      spell.name.toLowerCase().includes(query)
    );
    
    if (!filtered.length) {
      return bot.sendMessage(chatId, 
        `❌ Заклинания не найдены по запросу "${query}".\n\n💡 Попробуйте:\n• Ввести часть названия на английском: <code>/spell fire</code>\n• Проверить точное название: <code>/spell Fireball</code>`, 
        { parse_mode: 'HTML' }
      );
    }
    
    // Сохраняем результаты в состоянии
    userState[chatId] = {
      step: 'search_results',
      query,
      results: filtered,
      page: 1
    };
    
    await showSearchResults(chatId, query, filtered, 1);
    
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message, err.response?.status);
    bot.sendMessage(chatId, `⚠️ Ошибка при поиске: ${err.message}. Попробуйте позже.`);
  }
});

// Подсказка при вызове /spell без аргумента
bot.onText(/\/spell$/i, (msg) => {
  bot.sendMessage(msg.chat.id, '💡 Используйте: <code>/spell название</code>\nПример: <code>/spell Fireball</code>', { parse_mode: 'HTML' });
});

// Ручной ввод кубиков (например: 3d6)
bot.on('message', (msg) => {
  // Игнорируем, если это не текст или если сообщение от бота
  if (!msg.text || msg.from?.is_bot) return;
  
  if (/^(\d+)d(\d+)$/i.test(msg.text)) {
    const res = rollDice(msg.text);
    bot.sendMessage(msg.chat.id, `🎲 Результат: <b>${res.total}</b>\n📊 Броски: [${res.rolls.join(', ')}]`, { 
      parse_mode: 'HTML', 
      reply_markup: getDiceKeyboard() 
    });
  }
});

// Обработка кнопок (callback_query)
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;


  // 🔍 Глобальный лог
  console.log(`\n[CB] === НОВЫЙ ЗАПРОС ===`);
  console.log(`[CB] chatId=${chatId}, msgId=${msgId}`);
  console.log(`[CB] data="${data}"`);
  console.log(`[CB] userState:`, userState[chatId]);




  await bot.answerCallbackQuery(cb.id);
  
  // === ОБРАБОТКА ПОИСКА: выбор заклинания из списка ===
  if (data.startsWith('search_select__')) {
    const parts = data.split('__');
    if (parts.length < 3) {
      return bot.sendMessage(chatId, '⚠️ Ошибка формата запроса.');
    }
    const category = parts[1]; // 'spells'
    const index = parts[2];    // например, 'fireball'
    
    try {
      const res = await axios.get(`${API_BASE}/${category}/${index}`);
      const text = formatSpell(res.data);
      
      await bot.sendMessage(chatId, text, { 
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard()
      });
    } catch (err) {
      console.error('[SPELL DETAILS ERROR]', err.message);
      bot.sendMessage(chatId, `⚠️ Не удалось загрузить заклинание: ${err.message}`);
    }
    return;
  }
  
  // === ОБРАБОТКА ПОИСКА: пагинация результатов ===
  if (data.startsWith('search_page__')) {
    const [_, pageNum] = data.split('__');
    const state = userState[chatId];
    
    if (state?.step === 'search_results' && Array.isArray(state.results)) {
      const newPage = parseInt(pageNum);
      state.page = newPage;
      await showSearchResults(chatId, state.query, state.results, newPage);
    }
    return;
  }

  // === КНОПКА "НАЗАД В МЕНЮ" ===
  if (data === 'back_to_main') {
    userState[chatId] = { step: 'main' };
    return safeEdit(chatId, msgId, '🎲 Выберите функцию:', { reply_markup: getStartKeyboard() });
  }

  // === МЕНЮ КУБИКОВ ===
  if (data === 'dice_menu' || data.startsWith('dice_')) {
    return handleDice(chatId, msgId, data);
  }

  // === ПОДСКАЗКА ПО ПОИСКУ ===
  if (data === 'search_hint') {
    return safeEdit(chatId, msgId, '💡 Для поиска введите в чате:\n<code>/spell название</code>\nНапример: <code>/spell Fireball</code>', { 
      parse_mode: 'HTML', 
      reply_markup: getBackKeyboard() 
    });
  }

  // === КАТЕГОРИИ ===
  const categories = {
    'spells': 'Заклинания',
    'classes': 'Классы',
    'races': 'Расы',
    'monsters': 'Бестиарий',
    'magic-items': 'Магические предметы'
  };

  if (categories[data]) {
    console.log(`[CB] Категория выбрана: ${data}`);
    userState[chatId] = { category: data, page: 1 };
        try {
      // Принудительно вызываем с явными параметрами
      await showList(chatId, msgId, categories[data], data, 1);
      console.log(`[CB] ✅ showList отработал для ${data}`);
    } catch (err) {
      console.error(`[CB] ❌ КРИТИЧЕСКАЯ ОШИБКА при вызове showList:`, err);
      bot.sendMessage(chatId, `⚠️ Ошибка загрузки списка: ${err.message}`);
    }
    return;
    //return showList(chatId, msgId, categories[data], data, 1);
  }

  // === ПАГИНАЦИЯ КАТЕГОРИЙ ===
  if (data.startsWith('page__')) {
    const [_, cat, pageNum] = data.split('__');
    const newPage = parseInt(pageNum);
    
    if (!userState[chatId]) userState[chatId] = {};
    userState[chatId].category = cat;
    userState[chatId].page = newPage;
    
    return showList(chatId, msgId, categories[cat], cat, newPage);
  }

  // === ВЫБОР ЭЛЕМЕНТА ИЗ КАТЕГОРИИ ===
  if (data.startsWith('select__')) {
    const [_, cat, index] = data.split('__');
    try {
      const res = await axios.get(`${API_BASE}/${cat}/${index}`);
      const text = formatDetails(res.data, cat);
      return safeEdit(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: getBackKeyboard() });
    } catch (err) {
      console.error('[SELECT ERROR]', err.message);
      bot.sendMessage(chatId, '⚠️ Не удалось загрузить данные.');
    }
  }
});

// =============================================================================
// ЛОГИКА КУБИКОВ
// =============================================================================

function handleDice(chatId, msgId, data) {
  if (data === 'dice_menu') {
    return safeEdit(chatId, msgId, '🎲 Выберите кубик или введите вручную (напр. <code>3d6</code>):', { 
      parse_mode: 'HTML', 
      reply_markup: getDiceKeyboard() 
    });
  }

  let rolls, total;
  if (data === 'dice_2_20_adv') {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    rolls = [r1, r2];
    total = Math.max(r1, r2);
  } else {
    const parts = data.split('_');
    if (parts.length < 3) return;
    const count = parseInt(parts[1]);
    const sides = parseInt(parts[2]);
    
    rolls = []; 
    total = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r); 
      total += r;
    }
  }
  
  return safeEdit(chatId, msgId, `🎲 Результат: <b>${total}</b>\n📊 Броски: [${rolls.join(', ')}]`, { 
    parse_mode: 'HTML', 
    reply_markup: getDiceKeyboard() 
  });
}

// =============================================================================
// ЗАПУСК
// =============================================================================

console.log('✅ Бот запущен. Ожидает команды /start...');