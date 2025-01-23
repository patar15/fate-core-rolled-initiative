Hooks.once('init', () => {
  // Default initiative formula using FATE dice
  CONFIG.Combat.initiative.formula = '4df';

  // Override the method to calculate the initiative formula for a combatant
  Combatant.prototype._getInitiativeFormula = function() {
    // Accessing the Initiative skill dynamically from the actor's system data
    const initiativeSkillName = this.actor.system.initiativeSkill ? this.actor.system.initiativeSkill.toLowerCase() : 'notice'; // Default to 'notice' if not set
    console.log(`Initiative Skill Name: ${initiativeSkillName}`);  // Debug: check initiative skill name

    // Log the full system.skills object to debug structure
    console.log('Actor Skills:', this.actor.system.skills);  // Debug: log the full skills object
    
    // Iterate over the skills to find the one matching the initiative skill name (case-insensitive)
    const initiativeSkill = Object.values(this.actor.system.skills)
      .find(skill => skill.name.toLowerCase() === initiativeSkillName)?.rank || 0;  // Using rank instead of value

    console.log(`Initiative Skill Rank: ${initiativeSkill}`);  // Debug: check initiative skill rank
    
    // Ensure we return a properly formatted formula with 4df and the initiative skill rank modifier
    return `4df + ${initiativeSkill}`;
  };

  // Override rollInitiative to ensure it uses the custom formula
  Combat.prototype.rollInitiative = async function(ids, { formula = null, updateTurn = true, messageOptions = {}} = {}) {
    const combatants = this.combatants.filter(c => ids.includes(c.id));
    for (let c of combatants) {
      let formula = c._getInitiativeFormula(); // Ensure we get the custom formula
      console.log(`Initiative Formula Used: ${formula}`);  // Debug: check final initiative formula
      
      let roll = await new Roll(formula).evaluate({ async: true });

      // Update the combatant's initiative with the roll total
      await this.updateEmbeddedDocuments("Combatant", [{ _id: c.id, initiative: roll.total }]);

      // Create a chat message using the same roll object
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: c.actor }),
        flavor: "Initiative Roll",
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: roll,
        content: await roll.render(),  // Renders the roll to display dice details in chat
        sound: CONFIG.sounds.dice
      });
    }
  };
});

Hooks.on('renderCombatTracker', (app, html, data) => {
  html.find('.combatant-control.roll').off('click').on('click', async ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest('.combatant');
    const combatantId = li.data('combatant-id');
    const combatant = game.combat.combatants.get(combatantId);
    if (combatant) {
      // Use the combatant's specific initiative formula
      let formula = combatant._getInitiativeFormula();
      console.log(`Rolling Initiative with Formula: ${formula}`); // Debug: check formula
      await game.combat.rollInitiative([combatant.id], { formula: formula });
    }
  });
});
