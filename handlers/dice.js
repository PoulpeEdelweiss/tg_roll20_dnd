
const rollDice = (expression) => {
    const match = expression.match(/^(\d+)?d(\d+)$/i);
    if (!match) return { value: 0, details: 'Неверный формат' };
    
    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const rolls = [];
    
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    
    return {
        value: rolls.reduce((a, b) => a + b, 0),
        details: `Броски: [${rolls.join(', ')}]`
    };
};

const handleDiceCallback = async (bot, callbackQuery, chatId, userState) => {
    const data = callbackQuery.data;
    
    if (data === 'dice_menu') {
        userState[chatId] = { step: 'dice_menu' };
        return await bot.editMessageText('🎲 Выберите тип броска или введите свой (например, 3d8):', {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            reply_markup: getDiceKeyboard()
        });
    }
    
    if (data.startsWith('dice_')) {
        const [_, count, sides, modifier] = data.split('_');
        let result;
        
        if (modifier === 'adv') {
            // Преимущество: бросаем 2d20, берём лучший
            const roll1 = Math.floor(Math.random() * 20) + 1;
            const roll2 = Math.floor(Math.random() * 20) + 1;
            result = {
                value: Math.max(roll1, roll2),
                details: `Преимущество: [${roll1}, ${roll2}] → ${Math.max(roll1, roll2)}`
            };
        } else {
            result = rollDice(`${count}d${sides}`);
        }
        
        await bot.editMessageText(`🎲 Результат: *${result.value}*\n${result.details}`, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: getDiceKeyboard()
        });
    }
};

module.exports = {
    rollDice,
    handleDiceCallback
};