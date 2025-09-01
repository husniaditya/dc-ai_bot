const { checkCommandAndReply } = require('../../utils/validation');

module.exports = {
  name: 'math',
  execute: async (interaction) => {
    const op = interaction.options.getSubcommand();
    const store = require('../../config/store');
    
    // Check if the math command is enabled
    const commandName = `math ${op}`;
    const canExecute = await checkCommandAndReply(interaction, commandName, store, false);
    
    if (!canExecute) {
      return; // Command is disabled
    }
    
    const a = interaction.options.getNumber('a');
    const b = interaction.options.getNumber('b');
    let result;
    switch (op) {
      case 'add': result = a + b; break;
      case 'sub': result = a - b; break;
      case 'mul': result = a * b; break;
      case 'div': result = b === 0 ? 'Infinity (division by zero)' : a / b; break;
    }
    await interaction.reply({ content: `Result: ${result}` });
  }
};
