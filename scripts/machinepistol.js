console.log("Sanctum Machine Pistol Autofire | Loading...");

if (window._machinePistolHookId) {
  Hooks.off("createChatMessage", window._machinePistolHookId);
  delete window._machinePistolHookId;
}

if (!window._sanctumMachinePistolProcessed) window._sanctumMachinePistolProcessed = new Set();

window._machinePistolHookId = Hooks.on("createChatMessage", async (message) => {
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;
  if (window._sanctumMachinePistolProcessed.has(message.id)) return;

  try {
    const content = message.content || "";
    if (!content.includes("d10-rollcard-data")) return;

    const isAutofireAttack =
      content.includes('data-attack-type="autofire"') ||
      content.includes("data-attack-type='autofire'") ||
      /rollcard-subtitle-center[^>]*>\s*Autofire\s*</i.test(content);

    if (!isAutofireAttack) return;

    const itemIdMatch = content.match(/data-item-id=["']([^"']+)["']/i);
    if (!itemIdMatch) return;

    const itemId = itemIdMatch[1];
    let item = null;

    const controlled = canvas.tokens.controlled[0];
    if (controlled?.actor) item = controlled.actor.items.get(itemId);

    if (!item) {
      for (const actor of game.actors) {
        item = actor.items.get(itemId);
        if (item) break;
      }
    }
    if (!item) return;

    const weaponType = (item.system?.weaponType || "").toLowerCase().trim();
    const name = (item.name || "").toLowerCase();

    const isMachinePistol =
      weaponType === "machinepistol" ||
      weaponType === "machine pistol" ||
      name.includes("machine pistol") ||
      name.includes("machinepistol");

    if (!isMachinePistol) return;

    window._sanctumMachinePistolProcessed.add(message.id);
    if (window._sanctumMachinePistolProcessed.size > 50) {
      const first = window._sanctumMachinePistolProcessed.values().next().value;
      window._sanctumMachinePistolProcessed.delete(first);
    }

    let totalRoll = null;
    let match = content.match(/data-visible-element="d10-data-details">\s*(\d+)\s*</i);
    if (match) totalRoll = parseInt(match[1]);
    if (!totalRoll) {
      match = content.match(/d10-number-div[\s\S]*?<span[^>]*>\s*(\d+)\s*</i);
      if (match) totalRoll = parseInt(match[1]);
    }
    if (!totalRoll) {
      match = content.match(/>(\d{1,2})<\/span>/);
      if (match) totalRoll = parseInt(match[1]);
    }
    if (!totalRoll) return;

    const shooter = canvas.tokens.controlled[0];
    const target = Array.from(game.user.targets)[0];
    if (!shooter || !target) return;

    let distance = 0;
    try {
      distance = canvas.grid.measurePath([
        { x: shooter.x, y: shooter.y },
        { x: target.x, y: target.y }
      ]).distance;
    } catch (e) {}

    // Distance ranges +1 | DVs: 17, 20, 22, 27, 30
    let dv;
    if (distance <= 7) dv = 17;
    else if (distance <= 13) dv = 20;
    else if (distance <= 26) dv = 22;
    else if (distance <= 51) dv = 27;
    else dv = 30;

    const over = totalRoll - dv;

    let chatMessage, backgroundColor;

    if (over <= 0) {
      backgroundColor = "var(--cpr-text-chat-failure, #b90202ff)";
      chatMessage = `<b>${shooter.name} <span class="fg-red">missed</span> ${target.name}</b> by ${Math.abs(over) + 1} (Machine Pistol Autofire DV: ${dv})!`;
    } else {
      backgroundColor = "var(--cpr-text-chat-success, #2d9f36)";
      chatMessage = `<b>${shooter.name} <span class="fg-green">beats the ranged DV</span></b> (${dv}, ${over} over)<b> to hit ${target.name}</b> by ${over}! Roll damage IF they have NOT declared that they are dodging OR your roll has beat their evasion roll.`;
    }

    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:${backgroundColor}">${chatMessage}</div>`,
      type: message.type,
      whisper: message.whisper
    }, { chatBubble: false });

  } catch (err) {
    console.error("[Sanctum] Machine Pistol error:", err);
  }
});

console.log("Sanctum Machine Pistol Autofire | Ready");