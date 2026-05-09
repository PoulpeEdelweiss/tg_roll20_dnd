// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { getStartKeyboard, getDiceKeyboard, getBackKeyboard } = require('./handlers/keyboard');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const API_BASE = 'https://www.dnd5eapi.co/api';
const userState = {};

// Безопасное редактирование сообщений (игнорирует ошибку "not modified")
async function safeEdit(chatId, msgId, text, opts = {}) {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...opts });
  } catch (err) {
    if (err.response?.description?.includes('message is not modified')) return;
    console.error('Edit error:', err.message);
  }
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  userState[msg.chat.id] = { step: 'main' };
  bot.sendMessage(msg.chat.id, '🎲 Добро пожаловать в D&D 5e Bot!\nВыберите функцию:', {
    reply_markup: getStartKeyboard()
  });
});

// Команда /spell
// === НОВЫЙ ОБРАБОТЧИК /spell ===
bot.onText(/\/spell\s+(.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].trim().toLowerCase();
  
  // Показываем "печатает..."
  await bot.sendChatAction(chatId, 'typing');
  
  try {
    // Ищем по частичному совпадению имени
    const res = await axios.get(`${API_BASE}/spells`, { 
      params: { name: query } 
    });
    
    if (!res.data.results?.length) {
      return bot.sendMessage(chatId, 
        `❌ Заклинания не найдены по запросу "${query}".\n\n💡 Попробуйте:\n• Ввести часть названия: <code>/spell fire</code>\n• Проверить английское название: <code>/spell Fireball</code>`, 
        { parse_mode: 'HTML' }
      );
    }
    
    // Сохраняем результаты поиска в состоянии пользователя
    userState[chatId] = {
      step: 'search_results',
      query,
      results: res.data.results,
      page: 1
    };
    
    // Показываем список найденных заклинаний
    await showSearchResults(chatId, query, res.data.results, 1);
    
  } catch (err) {
    console.error('Search error:', err.message);
    bot.sendMessage(chatId, '⚠️ Ошибка при поиске заклинания.');
  }
});

bot.onText(/\/spell$/i, (msg) => {
  bot.sendMessage(msg.chat.id, '💡 Используйте: <code>/spell название</code>\nПример: <code>/spell Magic Missile</code>', { parse_mode: 'HTML' });
});

// Обработка кнопок
bot.on('callback_query', async (cb) => {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;

  await bot.answerCallbackQuery(cb.id);



    // === ОБРАБОТКА ПОИСКА: выбор заклинания из списка ===
  if (data.startsWith('search_select__')) {
    await bot.answerCallbackQuery(cb.id);
    const [_, __, category, index] = data.split('__'); // search_select__spells__fireball
    
    try {
      const spell = await axios.get(`${API_BASE}/${category}/${index}`);
      const text = formatSpell(spell.data);
      
      // Отправляем детали НОВЫМ сообщением (не редактируем список)
      await bot.sendMessage(chatId, text, { 
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard()
      });
    } catch (err) {
      console.error('Spell details error:', err.message);
      bot.sendMessage(chatId, '⚠️ Не удалось загрузить информацию.');
    }
    return;
  }
  
  // === ОБРАБОТКА ПОИСКА: пагинация результатов ===
  if (data.startsWith('search_page__')) {
    await bot.answerCallbackQuery(cb.id);
    const [_, pageNum] = data.split('__');
    const state = userState[chatId];
    
    if (state?.step === 'search_results') {
      const newPage = parseInt(pageNum);
      state.page = newPage;
      await showSearchResults(chatId, state.query, state.results, newPage);
      
      // Удаляем предыдущее сообщение со списком (опционально)
      // bot.deleteMessage(chatId, msgId); 
    }
    return;
  }






  if (data === 'back_to_main') {
    userState[chatId] = { step: 'main' };
    return safeEdit(chatId, msgId, '🎲 Выберите функцию:', { reply_markup: getStartKeyboard() });
  }

  if (data === 'dice_menu' || data.startsWith('dice_')) {
    return handleDice(chatId, msgId, data);
  }

  if (data === 'search_hint') {
    return safeEdit(chatId, msgId, '💡 Для поиска введите в чате:\n<code>/spell название</code>\nНапример: <code>/spell Fireball</code>', { parse_mode: 'HTML', reply_markup: getBackKeyboard() });
  }

  const categories = {
    'spells': 'Заклинания',
    'classes': 'Классы',
    'races': 'Расы',
    'monsters': 'Бестиарий',
    'magic-items': 'Магические предметы'
  };

  if (categories[data]) {
    userState[chatId] = { category: data, page: 1 };
    return showList(chatId, msgId, categories[data], data, 1);
  }

  // Пагинация
  if (data.startsWith('page__')) {
    const [_, cat, pageNum] = data.split('__');
    if (userState[chatId]?.category === cat) {
      userState[chatId].page = parseInt(pageNum);
      return showList(chatId, msgId, categories[cat], cat, parseInt(pageNum));
    }
  }

  // Выбор элемента
  if (data.startsWith('select__')) {
    const [_, cat, index] = data.split('__');
    try {
      const res = await axios.get(`${API_BASE}/${cat}/${index}`);
      const text = formatDetails(res.data, cat);
      return safeEdit(chatId, msgId, text, { parse_mode: 'HTML', reply_markup: getBackKeyboard() });
    } catch {
      bot.sendMessage(chatId, '⚠️ Не удалось загрузить данные.');
    }
  }
});

// Ручной ввод кубиков (например: 3d6)
bot.on('message', (msg) => {
  if (msg.text && /^(\d+)d(\d+)$/i.test(msg.text)) {
    const res = rollDice(msg.text);
    bot.sendMessage(msg.chat.id, `🎲 Результат: <b>${res.total}</b>\n📊 Броски: [${res.rolls.join(', ')}]`, { parse_mode: 'HTML', reply_markup: getDiceKeyboard() });
  }
});

// --- Логика ---

function handleDice(chatId, msgId, data) {
  if (data === 'dice_menu') {
    return safeEdit(chatId, msgId, '🎲 Выберите кубик или введите вручную (напр. <code>3d6</code>):', { parse_mode: 'HTML', reply_markup: getDiceKeyboard() });
  }

  let rolls, total;
  if (data === 'dice_2_20_adv') {
    const r1 = Math.floor(Math.random() * 20) + 1;
    const r2 = Math.floor(Math.random() * 20) + 1;
    rolls = [r1, r2];
    total = Math.max(r1, r2);
  } else {
    const [, count, sides] = data.split('_');
    rolls = []; total = 0;
    for (let i = 0; i < parseInt(count); i++) {
      const r = Math.floor(Math.random() * parseInt(sides)) + 1;
      rolls.push(r); total += r;
    }
  }
  return safeEdit(chatId, msgId, `🎲 Результат: <b>${total}</b>\n📊 Броски: [${rolls.join(', ')}]`, { parse_mode: 'HTML', reply_markup: getDiceKeyboard() });
}

async function showList(chatId, msgId, title, endpoint, page) {
  try {
    const limit = 10;
    const res = await axios.get(`${API_BASE}/${endpoint}`, { params: { limit, offset: (page - 1) * limit } });
    const items = res.data.results;

    const buttons = items.map(item => [{
      text: item.name,
      callback_data: `select__${endpoint}__${item.index}`
    }]);

    const pagination = [];
    if (page > 1) pagination.push({ text: '⬅️ Назад', callback_data: `page__${endpoint}__${page - 1}` });
    if (res.data.count > page * limit) pagination.push({ text: 'Вперёд ➡️', callback_data: `page__${endpoint}__${page + 1}` });

    const keyboard = {
      inline_keyboard: [
        ...buttons,
        ...(pagination.length ? [pagination] : []),
        [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
      ]
    };

    return safeEdit(chatId, msgId, `📚 ${title} (стр. ${page}):\nВыберите элемент:`, { reply_markup: keyboard });
  } catch {
    bot.sendMessage(chatId, '⚠️ Ошибка загрузки списка.');
  }
}

function rollDice(expr) {
  const [count, sides] = expr.split('d').map(Number);
  const rolls = []; let total = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r); total += r;
  }
  return { total, rolls };
}

function formatSpell(spell) {
  return `✨ <b>${spell.name}</b> (Ур. ${spell.level})\n📖 Школа: ${spell.school?.name || 'Нет'}\n⏱ Время: ${spell.casting_time}\n📏 Дальность: ${spell.range}\n🔮 Компоненты: ${spell.components?.join(', ')}\n⏳ Длительность: ${spell.duration}\n👤 Классы: ${spell.classes?.map(c => c.name).join(', ') || 'Нет'}\n\n📜 ${spell.desc?.[0] || 'Описание отсутствует'}`;
}

function formatDetails(data, type) {
  switch (type) {
    case 'classes': return `⚔️ <b>${data.name}</b>\n${data.desc?.[0] || ''}\n🩸 Кубик хитов: d${data.hit_die}`;
    case 'races': return `🧝 <b>${data.name}</b>\n${data.desc?.[0] || ''}\n📈 Бонусы: ${data.ability_bonuses?.map(b => `${b.ability_score.name} +${b.bonus}`).join(', ') || 'Нет'}`;
    case 'monsters': return `👹 <b>${data.name}</b>\n⚔️ CR: ${data.challenge_rating}\n❤️ HP: ${data.hit_points}\n🛡 AC: ${data.armor_class}\n📖 Тип: ${data.type}`;
    case 'magic-items': return `💎 <b>${data.name}</b>\n💠 Редкость: ${data.rarity?.name || 'Неизвестно'}\n\n${data.desc?.[0] || 'Описание отсутствует'}`;
    default: return `📄 <b>${data.name}</b>`;
  }
}



// === НОВАЯ ФУНКЦИЯ: показ списка результатов поиска ===
async function showSearchResults(chatId, query, results, page) {
  const PER_PAGE = 10;
  const start = (page - 1) * PER_PAGE;
  const pageResults = results.slice(start, start + PER_PAGE);
  const totalPages = Math.ceil(results.length / PER_PAGE);
  
  // Формируем кнопки с названиями заклинаний
  const buttons = pageResults.map(spell => [{
    text: spell.name,
    callback_data: `search_select__spells__${spell.index}`
  }]);
  
  // Кнопки пагинации
  const pagination = [];
  if (page > 1) pagination.push({ 
    text: '⬅️', 
    callback_data: `search_page__${page - 1}` 
  });
  if (page < totalPages) pagination.push({ 
    text: '➡️', 
    callback_data: `search_page__${page + 1}` 
  });
  
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
  
  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
}


console.log('✅ Бот запущен. Ожидает команды /start...');