// handlers/keyboard.js

exports.getStartKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🎲 Бросить дайсы', callback_data: 'dice_menu' }, { text: '🔍 Поиск', callback_data: 'search_hint' }],
    [{ text: '✨ Заклинания', callback_data: 'spells' }, { text: '⚔️ Классы', callback_data: 'classes' }],
    [{ text: '🧝 Расы', callback_data: 'races' }, { text: '👹 Бестиарий', callback_data: 'monsters' }],
    [{ text: '💎 Магические предметы', callback_data: 'magic-items' }]
  ]
});

// === НОВЫЕ КЛАВИАТУРЫ ДЛЯ ПОШАГОВОГО ВЫБОРА КУБИКОВ ===

// Шаг 1: Выбор количества кубиков
exports.getDiceCountKeyboard = () => ({
  inline_keyboard: [
    [{ text: '✍️ Ввести формулу', callback_data: 'dice_custom_input' }],
    [
      { text: '1', callback_data: 'dice_count_1' },
      { text: '2', callback_data: 'dice_count_2' },
      { text: '3', callback_data: 'dice_count_3' },
      { text: '4', callback_data: 'dice_count_4' },
      { text: '5', callback_data: 'dice_count_5' }
    ],
    [
      { text: '6', callback_data: 'dice_count_6' },
      { text: '8', callback_data: 'dice_count_8' },
      { text: '10', callback_data: 'dice_count_10' }
    ],
    [{ text: '🔙 В меню', callback_data: 'back_to_main' }]
  ]
});

// Шаг 2: Выбор типа кубика (грани)
exports.getDiceTypeKeyboard = () => ({
  inline_keyboard: [
    [
      { text: 'd4', callback_data: 'dice_type_4' },
      { text: 'd6', callback_data: 'dice_type_6' },
      { text: 'd8', callback_data: 'dice_type_8' }
    ],
    [
      { text: 'd10', callback_data: 'dice_type_10' },
      { text: 'd12', callback_data: 'dice_type_12' },
      { text: 'd20', callback_data: 'dice_type_20' },
      { text: 'd100', callback_data: 'dice_type_100' }
    ],
    [{ text: '⬅️ Назад', callback_data: 'dice_step_back_count' }]
  ]
});

// Шаг 3: Выбор режима (обычный / преимущество / помеха)
exports.getDiceModeKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '🎲 Обычный', callback_data: 'dice_mode_normal' },
      { text: '✅ Преимущество', callback_data: 'dice_mode_adv' },
      { text: '❌ Помеха', callback_data: 'dice_mode_dis' }
    ],
    [{ text: '⬅️ Назад', callback_data: 'dice_step_back_type' }]
  ]
});

// Клавиатура после броска (повторить / в меню)
exports.getDiceResultKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '🔄 Бросить ещё', callback_data: 'dice_restart' },
      { text: '🔙 В меню', callback_data: 'back_to_main' }
    ]
  ]
});

exports.getBackKeyboard = () => ({
  inline_keyboard: [[{ text: '🔙 В меню', callback_data: 'back_to_main' }]]
});