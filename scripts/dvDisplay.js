console.log("%c[Sanctum DV] Diwako inject loaded", "color: #0f0; font-weight: bold");

const MODULE_ID = "sanctum-cpr-hooks"; // must match your module.json id

const SANCTUM_DV_TABLES = {
  machinegun: [
    { max: 7, dv: 21 },
    { max: 13, dv: 18 },
    { max: 26, dv: 18 },
    { max: 51, dv: 19 },
    { max: Infinity, dv: 25 }
  ],
  subcompactsmg: [
    { max: 7, dv: 20 },
    { max: 13, dv: 17 },
    { max: 26, dv: 20 },
    { max: 51, dv: 25 },
    { max: Infinity, dv: 30 }
  ],
  machinepistol: [
    { max: 7, dv: 17 },
    { max: 13, dv: 20 },
    { max: 26, dv: 22 },
    { max: 51, dv: 27 },
    { max: Infinity, dv: 30 }
  ]
};

const _sanctumAppended = new WeakSet();

function getWeaponTypeKey(item) {
  const type = (item.system?.weaponType || "").toLowerCase().trim();
  const name = (item.name || "").toLowerCase();

  if (type === "machinegun" || type === "machine gun") {
    if (
      name.includes("bmg-500") ||
      name.includes("bmg 500") ||
      name.includes("russia bmg")
    ) {
      return null;
    }
    return "machinegun";
  }

  if (
    type === "subcompactsmg" ||
    type === "subcompact smg" ||
    type === "sub compact smg"
  ) {
    return "subcompactsmg";
  }

  if (type === "machinepistol" || type === "machine pistol") {
    return "machinepistol";
  }

  return null;
}

function getSanctumDV(typeKey, distance) {
  const table = SANCTUM_DV_TABLES[typeKey];
  if (!table) return null;
  for (const band of table) {
    if (distance <= band.max) return band.dv;
  }
  return null;
}

function getDistance(tokenA, tokenB) {
  try {
    return canvas.grid.measurePath([
      { x: tokenA.x, y: tokenA.y },
      { x: tokenB.x, y: tokenB.y }
    ]).distance;
  } catch (e) {
    return 0;
  }
}

function appendSanctumLinesToDiwako(hoveredToken) {
  try {
    if (_sanctumAppended.has(hoveredToken)) return;

    const controlled = canvas.tokens.controlled[0];
    if (!controlled || controlled === hoveredToken || !controlled.actor) return;

    const diwakoDisplay = hoveredToken.dvDisplay;
    if (!diwakoDisplay) return;

    const existingText = diwakoDisplay.children.find(
      (c) => c instanceof PreciseText || (c && typeof c.text === "string")
    );
    if (!existingText) return;

    const dist = getDistance(controlled, hoveredToken);
    const extraLines = [];

    for (const item of controlled.actor.items) {
      if (item.type !== "weapon") continue;
      if (item.system?.equipped !== "equipped") continue;

      const typeKey = getWeaponTypeKey(item);
      if (!typeKey) continue;

      const dv = getSanctumDV(typeKey, dist);
      if (dv == null) continue;

      // Exact Diwako format
      extraLines.push(`DV: ${dv} ${item.name} (Autofire)`);
    }

    // Merge Diwako lines + Sanctum lines
    const current = (existingText.text || "").trim();
    const allLines = current
      ? current.split("\n").map((l) => l.trim()).filter(Boolean)
      : [];

    allLines.push(...extraLines);

    // Remove duplicates
    const unique = [...new Set(allLines)];

    // Sort lowest DV → highest DV
    unique.sort((a, b) => {
      const dvA = parseInt(a.match(/DV:\s*(\d+)/)?.[1] || "999", 10);
      const dvB = parseInt(b.match(/DV:\s*(\d+)/)?.[1] || "999", 10);
      return dvA - dvB;
    });

    existingText.text = unique.join("\n");
    _sanctumAppended.add(hoveredToken);

    // Reposition like Diwako after text size changes
    const side =
      game.settings.get("diwako-cpred-additions", "dvDisplayPosition") || "right";
    if (side === "right") {
      diwakoDisplay.position.set(hoveredToken.w + diwakoDisplay.width + 15, 0);
    } else {
      diwakoDisplay.position.set(-15, 0);
    }

    console.log("%c[Sanctum DV] Sorted + appended + repositioned", "color: #0f0");
  } catch (err) {
    console.error("[Sanctum DV] ERROR:", err);
  }
}

function startSanctumDV() {
  if (!game.modules.get("diwako-cpred-additions")?.active) {
    console.warn("[Sanctum DV] Diwako not active");
    return;
  }
  if (!globalThis.libWrapper) {
    console.warn("[Sanctum DV] libWrapper required");
    return;
  }
  if (typeof Token.prototype.showDVDisplay !== "function") {
    console.warn("[Sanctum DV] Diwako showDVDisplay not found");
    return;
  }

  try {
    libWrapper.register(
      MODULE_ID,
      "Token.prototype.showDVDisplay",
      async function (wrapped, ...args) {
        await wrapped.apply(this, args);
        appendSanctumLinesToDiwako(this);
      },
      "WRAPPER"
    );
    console.log("%c[Sanctum DV] Plugged into Diwako OK", "color: #0f0; font-weight: bold");
  } catch (err) {
    console.error("[Sanctum DV] libWrapper failed:", err);
  }

  // Allow refresh on next hover
  Hooks.on("hoverToken", (token, hovered) => {
    if (!hovered) _sanctumAppended.delete(token);
  });
}

if (game.ready) startSanctumDV();
else Hooks.once("ready", startSanctumDV);

console.log("Sanctum DV Display | Ready");