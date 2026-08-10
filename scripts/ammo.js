console.log("Sanctum Ammo Hooks 1.1 | Loading...");

const ammoHookList = [
  "_explosiveDamageHookId",
  "_highPrecisionHookId",
  "_ammoReminderHookId"
];

ammoHookList.forEach(id => {
  if (window[id]) {
    Hooks.off("renderCPRRollDialog", window[id]);
    Hooks.off("createChatMessage", window[id]);
    delete window[id];
  }
});

if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
if (!window._sanctumProcessed) window._sanctumProcessed = new Set();

function getDiceValues(content) {
  const values = [];
  const regex = /d6_(\d)(_preem)?\.svg/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    values.push(parseInt(match[1]));
  }
  if (values.length === 0) {
    const numbers = [...content.matchAll(/>([1-6])</g)].map(m => parseInt(m[1]));
    if (numbers.length >= 3) values.push(...numbers.slice(0, 6));
  }
  return values;
}

function alreadyProcessed(id) {
  if (window._sanctumProcessed.has(id)) return true;
  window._sanctumProcessed.add(id);
  if (window._sanctumProcessed.size > 100) {
    const first = window._sanctumProcessed.values().next().value;
    window._sanctumProcessed.delete(first);
  }
  return false;
}

// Explosive Reminder
window._explosiveDamageHookId = Hooks.on("createChatMessage", (message) => {
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;
  if (alreadyProcessed(message.id + "-explosive")) return;

  try {
    const content = message.content || "";
    if (!/explosive/i.test(content)) return;
    if (!content.includes("d6-rollcard-data") && !content.toLowerCase().includes("damage")) return;

    const dice = getDiceValues(content);
    const sixes = dice.filter(v => v === 6);
    const highDice = dice.filter(v => v >= 5);

    if (sixes.length >= 2) return;
    if (highDice.length < 2) return;
    if (content.includes("You dun did fuck them up")) return;

    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:var(--cpr-text-chat-success, #2d9f36)">
        <b>You dun did fuck them up</b><br>Don't forget that <b>+5 damage</b>.
      </div>`,
      type: message.type,
      whisper: message.whisper
    }, { chatBubble: false });

  } catch (err) {
    console.error("[Sanctum] Explosive error:", err);
  }
});

// To-Hit Modifiers
window._highPrecisionHookId = Hooks.on("renderCPRRollDialog", (app, html) => {
  if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
  if (window._ammoHookProcessed.has(app)) return;
  window._ammoHookProcessed.set(app, true);

  try {
    const { actor, item } = app;
    if (!item || item.type !== "weapon") return;

    const title = (html.closest(".app")?.find(".window-title").text() || "").toLowerCase();
    const bodyText = html.text().toLowerCase();

    const isDamageDialog =
      title.includes("damage") ||
      title.includes("rolling damage") ||
      bodyText.includes("rolling damage") ||
      bodyText.includes("damage:") ||
      bodyText.includes("damage 5d6") ||
      bodyText.includes("damage 4d6") ||
      bodyText.includes("damage 3d6") ||
      bodyText.includes("damage 2d6") ||
      bodyText.includes("damage 1d6");

    if (isDamageDialog) {
      console.log("%c→ Skipping DAMAGE dialog", "color: orange");
      return;
    }

    const installed = item.system?.installedItems?.list || [];
    const ammoItems = installed
      .map(id => actor.items.get(id))
      .filter(a => a?.type === "ammo");

    const hasTracer = ammoItems.some(a => a.system?.type === "tracer" || /tracer/i.test(a.name));
    const hasHighPrecision = ammoItems.some(a => a.system?.type === "highprecision" || /high.?precision/i.test(a.name));
    const hasExplosive = ammoItems.some(a => a.system?.type === "explosive" || /explosive/i.test(a.name));

    const modInput = html.find("input[name='additionalMods']");
    if (!modInput.length) return;

    const getFiringMode = () => {
      const text = html.text().toLowerCase();
      const hasAimFor = text.includes("aim for") || html.find("select, [name*='aim'], [id*='aim']").length > 0;

      const aimedBox = html.find("input[name='isAimed'], input[name='aimed'], input[id*='aimed'], input[id*='Aimed']");
      const autofireBox = html.find("input[name='isAutofire'], input[name='autofire'], input[id*='autofire'], input[id*='Autofire']");

      let isAimed = aimedBox.length ? aimedBox.is(":checked") : false;
      let isAutofire = autofireBox.length ? autofireBox.is(":checked") : false;

      if (!aimedBox.length && !autofireBox.length) {
        isAimed = text.includes("aimed") || hasAimFor;
        isAutofire = text.includes("autofire") && !hasAimFor;
      }

      if (hasAimFor) {
        isAimed = true;
        isAutofire = false;
      }

      return { isAimed, isAutofire };
    };

    const applyMods = () => {
      const { isAimed, isAutofire } = getFiringMode();
      let added = 0;
      const messages = [];

      if (hasHighPrecision && !isAutofire) {
        if (isAimed) {
          added += 2;
          messages.push("High Precision Ammo: +2 To Hit (Aimed)");
        } else {
          added += 1;
          messages.push("High Precision Ammo: +1 To Hit");
        }
      }

      if (hasTracer && isAutofire) {
        added += 1;
        messages.push("Tracer Ammo: +1 To Hit (Autofire)");
      }

      if (hasExplosive) {
        if (isAimed) {
          added -= 100;
          messages.push("Explosive Ammo: –100 To Hit (Aimed)");
        } else {
          added -= 2;
          messages.push("Explosive Ammo: –2 To Hit");
        }
      }

      html.find("p.sanctum-ammo-msg").remove();

      if (added !== 0) {
        modInput.val(added);
        const el = modInput[0];
        el.dispatchEvent(new Event("focus", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        modInput.trigger("focus").trigger("input").trigger("change").trigger("blur");

        messages.forEach(msg => {
          modInput.closest(".form-group").after(
            `<p class="sanctum-ammo-msg" style="color:#e74c3c;font-weight:bold;margin:6px 0;">${msg}</p>`
          );
        });
      } else {
        modInput.val(0);
        modInput.trigger("input").trigger("change");
      }
    };

    setTimeout(applyMods, 80);
    html.find("input[type='checkbox'], select").off("change.sanctum").on("change.sanctum", () => {
      setTimeout(applyMods, 50);
    });

  } catch (err) {
    console.error("[Sanctum] To-hit error:", err);
  }
});

// Other Ammo Reminders
window._ammoReminderHookId = Hooks.on("createChatMessage", (message) => {
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;
  if (alreadyProcessed(message.id + "-reminder")) return;

  const c = (message.content || "").toLowerCase();
  if (!c.includes("rollcard-data")) return;

  const dice = getDiceValues(message.content);

  if (c.includes("burrowing") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Burrowing Ammo</b><br>Critical Injuries are harder to Quick Fix (DV +2).</div>`
    }, { chatBubble: false });
  }

  if (c.includes("high velocity") || c.includes("highvelocity")) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>High Velocity Ammo</b><br>Target takes –2 to Dodge.</div>`
    }, { chatBubble: false });
  }

  if (c.includes("hyper expansive") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hyper Expansive Ammo</b><br>Extra Critical Injury roll.</div>`
    }, { chatBubble: false });
  }

  if ((c.includes("hollow point") || c.includes("serrated")) && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hollow Point / Serrated</b><br>+1 Base Death Save + possible extra Injury.</div>`
    }, { chatBubble: false });
  }
});

console.log("Sanctum Ammo Hooks 1.1 | Ready");