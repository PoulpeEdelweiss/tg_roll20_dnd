exports.getStartKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🎲 Бросить дайсы', callback_data: 'dice_menu' }, { text: '🔍 Поиск', callback_data: 'search_hint' }],
    [{ text: '✨ Заклинания', callback_data: 'spells' }, { text: '⚔️ Классы', callback_data: 'classes' }],
    [{ text: '🧝 Расы', callback_data: 'races' }, { text: '👹 Бестиарий', callback_data: 'monsters' }],
    [{ text: '💎 Магические предметы', callback_data: 'magic-items' }]
  ]
});

exports.getDiceKeyboard = () => ({
  inline_keyboard: [
    [{ text: '1d4', callback_data: 'dice_1_4' }, { text: '2d6', callback_data: 'dice_2_6' }, { text: '1d8', callback_data: 'dice_1_8' }],
    [{ text: '1d10', callback_data: 'dice_1_10' }, { text: '1d12', callback_data: 'dice_1_12' }, { text: '1d20', callback_data: 'dice_1_20' }],
    [{ text: '2d20 (преимущество)', callback_data: 'dice_2_20_adv' }, { text: '🔙 В меню', callback_data: 'back_to_main' }]
  ]
});

exports.getBackKeyboard = () => ({
  inline_keyboard: [[{ text: '🔙 В меню', callback_data: 'back_to_main' }]]
});