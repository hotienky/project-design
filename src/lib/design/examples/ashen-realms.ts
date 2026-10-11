/**
 * A game design example (overview.mode "game"): a co-op action RPG with loot-based
 * progression. Exercises loops, systems, mechanics, resources, content tables and
 * every game edge kind. Used by tests and by "New project → Example: Ashen Realms".
 */
import { nodeSize } from "@/lib/design/geometry";
import { NodeSchema, type DesignDocumentInput } from "@/lib/design/schema";

export const ASHEN_REALMS_EXAMPLE = {
  name: "Ashen Realms",
  slug: "ashen-realms",
  description: "Top-down co-op action RPG with loot-based progression (Unity, online co-op, PvE).",
} as const;

type NodeIn = NonNullable<DesignDocumentInput["nodes"]>[number];
type EdgeIn = NonNullable<DesignDocumentInput["edges"]>[number];
type Data<K extends NodeIn["kind"]> = NonNullable<Extract<NodeIn, { kind: K }>["data"]>;
type Priority = "mvp" | "launch" | "later";

// ── Node builders ───────────────────────────────────────────────────────────

const loop = (id: string, name: string, y: number, data: Data<"loop">): NodeIn => ({
  id,
  kind: "loop",
  name,
  position: { x: -400, y },
  data,
});

const mech = (id: string, name: string, data: Data<"mechanic">): NodeIn => ({
  id,
  kind: "mechanic",
  name,
  data,
});
const res = (id: string, name: string, data: Data<"resource">): NodeIn => ({
  id,
  kind: "resource",
  name,
  data,
});
const cnt = (
  id: string,
  name: string,
  columns: string[],
  rows: string[][],
  type: Data<"content">["type"] = "table",
  priority: Priority = "mvp",
): NodeIn => ({ id, kind: "content", name, data: { type, columns, rows, priority } });
const ent = (id: string, name: string, data: Data<"entity">): NodeIn => ({
  id,
  kind: "entity",
  name,
  data,
});

interface SystemSpec {
  node: NodeIn;
  children: NodeIn[];
}
const COLS = 3;
const sys = (
  id: string,
  name: string,
  data: Data<"system">,
  children: NodeIn[] = [],
): SystemSpec => ({ node: { id, kind: "system", name, data }, children });

/** Lays children out in a grid inside their system (rows as tall as their tallest card) and sizes the system to fit. */
function layoutSystem(spec: SystemSpec, position: { x: number; y: number }) {
  const heights = spec.children.map((c) => nodeSize(NodeSchema.parse(c)).height);
  const rowTops: number[] = [];
  let y = 60;
  for (let i = 0; i < spec.children.length; i += COLS) {
    rowTops.push(y);
    y += Math.max(...heights.slice(i, i + COLS)) + 24;
  }
  const size = { width: COLS * 232 + 24, height: Math.max(y, 60 + 54 + 24) };
  const children = spec.children.map((c, i): NodeIn => ({
    ...c,
    parentId: spec.node.id,
    position: { x: 24 + (i % COLS) * 232, y: rowTops[Math.floor(i / COLS)]! },
  }));
  return { node: { ...spec.node, position, size } as NodeIn, children, size };
}

const field = (
  name: string,
  type: "string" | "int" | "uuid" | "json" | "datetime",
  extra: { primary?: boolean; unique?: boolean; description?: string } = {},
) => ({ name, type, ...extra });

// ── Systems ─────────────────────────────────────────────────────────────────

const systems: SystemSpec[] = [
  sys(
    "sys_combat",
    "Combat",
    {
      category: "combat",
      authority: "server",
      priority: "mvp",
      purpose:
        "Real-time action combat: responsive attacks, dodging and readable enemy telegraphs. " +
        "Skill and positioning matter more than stats.",
      rules: [
        "Every attack has explicit Startup, Active and Recovery phases defined in data",
        "Damage is resolved on the server; clients show predicted feedback only",
        "Hit-stop, stagger and cancel windows are defined explicitly per attack",
      ],
      parameters: [{ name: "Server tick", value: "30", unit: "Hz" }],
    },
    [
      mech("mec_attack", "Attack phases", {
        trigger: "Attack input",
        states: ["Startup", "Active", "Recovery"],
        rules: [
          "Dodge can cancel Recovery (and late Startup)",
          "Attack input is buffered during Recovery and fires on its last frames",
          "Hit-stop on hit: 40–80 ms freeze for attacker and target",
          "Stagger is driven by Poise: a hit that empties Poise staggers the target",
        ],
        priority: "mvp",
      }),
      mech("mec_dodge", "Dodge", {
        trigger: "Space / B",
        states: ["Dodge start", "Invulnerability window", "Recovery"],
        parameters: [
          { name: "Stamina cost", value: "25" },
          { name: "Cooldown", value: "0.6", unit: "s" },
        ],
        rules: ["Server validates stamina and cooldown before granting invulnerability"],
        priority: "mvp",
      }),
      mech("mec_damage", "Damage calculation", {
        trigger: "Hit confirmed by server",
        formulas: [
          {
            name: "Raw damage",
            expression: "D_raw = (W × S + F) × M",
            notes: "W weapon damage, S skill scaling, F flat bonuses, M multiplier product",
          },
          {
            name: "Final damage",
            expression: "D_final = D_raw × 100 / (100 + A)",
            notes: "A is the target's armor",
          },
        ],
        rules: [
          "Damage calculation is a deterministic, testable pure domain service (no engine types)",
        ],
        priority: "mvp",
      }),
      cnt(
        "cnt_controls",
        "Controls",
        ["Action", "Keyboard / Mouse", "Controller"],
        [
          ["Move", "WASD", "Left stick"],
          ["Aim", "Mouse", "Right stick"],
          ["Basic attack", "Left click", "RT"],
          ["Heavy attack", "Right click", "RB"],
          ["Dodge", "Space", "B / Circle"],
          ["Skill 1–4", "Q, E, R, F", "Face buttons / modifiers"],
          ["Potion", "1", "D-pad"],
          ["Interact", "G", "A / Cross"],
        ],
      ),
    ],
  ),
  sys(
    "sys_character",
    "Character & attributes",
    {
      category: "character",
      authority: "server",
      priority: "mvp",
      purpose: "The player's stats, attributes and weapon archetypes that define a build.",
      rules: ["Derived stats are recomputed from attributes and equipment, never stored"],
    },
    [
      res("res_health", "Health", {
        type: "stat",
        initial: "100",
        min: "0",
        regen: "Potions and healing only",
      }),
      res("res_mana", "Mana", {
        type: "stat",
        initial: "100",
        min: "0",
        regen: "Passive regeneration",
      }),
      res("res_stamina", "Stamina", {
        type: "stat",
        initial: "100",
        min: "0",
        regen: "20/s after delay",
      }),
      res("res_poise", "Poise", { type: "stat", regen: "Recovers when not hit" }),
      cnt(
        "cnt_attributes",
        "Attributes",
        ["Attribute", "Effects"],
        [
          ["Strength", "Heavy weapon scaling, poise damage"],
          ["Dexterity", "Precision weapon scaling, handling"],
          ["Intelligence", "Magic damage, mana efficiency"],
          ["Vitality", "Health, survivability"],
          ["Endurance", "Stamina, equipment capacity"],
          ["Spirit", "Healing and support scaling"],
        ],
      ),
      cnt(
        "cnt_archetypes",
        "Weapon archetypes",
        ["Archetype", "Weapons", "Role"],
        [
          ["Vanguard", "Sword / Shield", "Defensive control, team protection"],
          ["Ranger", "Bow / Crossbow", "Ranged pressure, traps"],
          ["Arcanist", "Staff / Focus", "Elemental spells, area control"],
          ["Shadowblade", "Dual Daggers", "Mobility, burst damage"],
        ],
        "class",
      ),
    ],
  ),
  sys(
    "sys_abilities",
    "Abilities & skills",
    {
      category: "abilities",
      authority: "server",
      priority: "mvp",
      purpose: "Weapon-bound active skills with upgrade branches that define playstyle.",
    },
    [
      mech("mec_skill_exec", "Skill execution pipeline", {
        trigger: "Skill input",
        states: [
          "Client input & cast feedback",
          "Server validates",
          "Server commits resources & executes at tick",
          "Server resolves hits / effects",
          "Replicate & reconcile",
        ],
        rules: ["Resources are spent only by the server when the skill executes"],
        priority: "mvp",
      }),
      mech("mec_skill_branches", "Skill upgrade branches", {
        rules: ["Branches are mutually exclusive per tier"],
        parameters: [
          { name: "Weapon families", value: "4" },
          { name: "Active skills per family", value: "6" },
          { name: "Branches per skill", value: "2" },
        ],
        priority: "launch",
      }),
    ],
  ),
  sys(
    "sys_inventory",
    "Inventory & equipment",
    {
      category: "items",
      authority: "backend",
      priority: "mvp",
      purpose: "Owned items and the equipment slots that turn items into stats and effects.",
      rules: ["Every item is a persistent instance with a stable id"],
    },
    [
      cnt(
        "cnt_slots",
        "Equipment slots",
        ["Slot", "Count", "Contribution"],
        [
          ["Helmet", "1", "Defense, utility"],
          ["Body Armor", "1", "Main defense"],
          ["Gloves", "1", "Attack modifiers"],
          ["Boots", "1", "Mobility"],
          ["Rings", "2", "Specialized modifiers"],
          ["Amulet", "1", "Major build bonuses"],
          ["Charms", "2", "Conditional effects"],
          ["Left-Hand", "1", "Shield, off-hand, weapon"],
          ["Right-Hand", "1", "Main weapon"],
        ],
        "table",
      ),
      ent("ent_item_instance", "ItemInstance", {
        fields: [
          field("InstanceId", "uuid", { primary: true }),
          field("DefinitionId", "string"),
          field("ItemLevel", "int"),
          field("Quantity", "int"),
          field("Affixes", "json"),
        ],
      }),
      mech("mec_equip", "Equip rules", {
        trigger: "Equip request",
        rules: [
          "Server validates slot, level and attribute requirements",
          "Equipping recomputes derived stats on the server",
        ],
        priority: "mvp",
      }),
    ],
  ),
  sys(
    "sys_loot",
    "Loot",
    {
      category: "items",
      authority: "server",
      priority: "mvp",
      purpose: "Drops that drive progression: rarity, modifiers and rare build-defining effects.",
    },
    [
      mech("mec_personal_loot", "Personal loot", {
        trigger: "Enemy or boss defeated",
        rules: [
          "Every player gets an independent server-side roll",
          "Items get persistent ids at roll time",
          "Inventory updates are atomic",
        ],
        priority: "mvp",
      }),
      cnt(
        "cnt_rarity",
        "Rarity tiers",
        ["Rarity", "Modifiers"],
        [
          ["Common", "Base stats"],
          ["Uncommon", "1 modifier"],
          ["Rare", "2–3 modifiers"],
          ["Epic", "3–4 modifiers"],
          ["Legendary", "Unique gameplay effect"],
        ],
        "item",
      ),
      cnt(
        "cnt_legendary",
        "Legendary effects",
        ["Effect"],
        [
          ["Dodge creates a temporary fire trail."],
          ["Blocking stores damage for the next heavy attack."],
          ["Poisoned enemies explode when defeated."],
          ["Healing an ally grants both players a shield."],
        ],
        "item",
        "launch",
      ),
    ],
  ),
  sys(
    "sys_enemies",
    "Enemies & AI",
    {
      category: "ai",
      authority: "server",
      priority: "mvp",
      purpose: "Enemies with distinct readable behaviours, counterplay and clear telegraphs.",
      rules: ["AI runs only on the server", "Difficulty comes from behaviour, not stat inflation"],
    },
    [
      cnt(
        "cnt_enemy_archetypes",
        "Enemy archetypes",
        ["Archetype", "Behavior", "Counterplay"],
        [
          ["Bruiser", "Slow, heavy attacks", "Dodge and punish"],
          ["Skirmisher", "Fast movement, flanking", "Crowd control"],
          ["Artillery", "Long-range attacks", "Close distance"],
          ["Support", "Buffs or heals enemies", "Target priority"],
          ["Summoner", "Creates additional enemies", "Interrupt or eliminate"],
          ["Elite", "Modified mechanics", "Adapt positioning"],
        ],
        "enemy",
      ),
      mech("mec_telegraphs", "Telegraphs", {
        trigger: "Enemy begins a dangerous attack",
        rules: [
          "Every dangerous attack shows a ground or body telegraph before the Active phase",
          "Telegraph duration is data-driven per attack",
        ],
        priority: "mvp",
      }),
    ],
  ),
  sys(
    "sys_bosses",
    "Bosses",
    {
      category: "ai",
      authority: "server",
      priority: "mvp",
      purpose: "Multi-phase encounters that test mechanics and teamwork.",
    },
    [
      cnt(
        "cnt_guardian_phases",
        "Hollow Guardian phases",
        ["Phase", "Health", "Mechanics"],
        [
          ["1", "100–70%", "Sweeps, slams, frontal attacks"],
          ["2", "70–35%", "Summons, arena hazards"],
          ["3", "35–0%", "Faster combos, limited safe zones"],
        ],
        "boss",
      ),
      mech("mec_coop_mechanics", "Solo-solvable co-op mechanics", {
        rules: [
          "Co-op mechanics reward coordination but can always be solved by one player",
          "Boss health scales with player count through difficulty scaling only",
        ],
        priority: "mvp",
      }),
    ],
  ),
  sys(
    "sys_progression",
    "Progression",
    {
      category: "progression",
      authority: "backend",
      priority: "mvp",
      purpose: "Long-term growth: character levels, weapon mastery and difficulty scaling.",
    },
    [
      res("res_xp", "Experience", { type: "experience", initial: "0", min: "0" }),
      mech("mec_leveling", "Character leveling", {
        trigger: "Experience threshold reached",
        parameters: [{ name: "Level cap", value: "50" }],
        priority: "mvp",
      }),
      mech("mec_mastery", "Weapon mastery", {
        trigger: "Mastery tokens spent",
        rules: ["Mastery is per weapon family and unlocks skill branches"],
        priority: "launch",
      }),
      cnt(
        "cnt_difficulty",
        "Difficulty scaling",
        ["Players", "Enemy HP ×", "Enemy damage ×"],
        [
          ["1", "1.0", "1.0"],
          ["2", "1.6", "1.0"],
          ["3", "2.2", "1.1"],
          ["4", "2.8", "1.15"],
        ],
      ),
    ],
  ),
  sys(
    "sys_economy",
    "Economy & crafting",
    {
      category: "economy",
      authority: "backend",
      priority: "launch",
      purpose: "Currencies, materials and crafting that turn surplus loot into build progress.",
      rules: ["No player trading at launch"],
    },
    [
      res("res_gold", "Gold", { type: "currency", initial: "0", min: "0" }),
      res("res_essence", "Essence", { type: "currency", initial: "0", min: "0" }),
      res("res_mastery_tokens", "Mastery Tokens", { type: "currency", initial: "0", min: "0" }),
      res("res_materials", "Crafting Materials", { type: "material", initial: "0", min: "0" }),
      mech("mec_crafting", "Crafting", {
        trigger: "Craft request at the hub",
        states: ["Dismantle", "Upgrade", "Reroll one modifier"],
        rules: [
          "Dismantle destroys an item and yields Essence",
          "Upgrade raises item level for gold and materials",
          "Reroll replaces exactly one modifier",
          "Crafting is atomic and server-validated",
        ],
        priority: "launch",
      }),
    ],
  ),
  sys(
    "sys_dungeons",
    "Dungeons & world",
    {
      category: "world",
      authority: "server",
      priority: "mvp",
      purpose: "A social hub plus instanced expeditions assembled from authored rooms.",
    },
    [
      mech("mec_room_assembly", "Seeded room assembly", {
        trigger: "Expedition start",
        rules: [
          "Rooms are authored prefabs; only their assembly is random",
          "The layout is seeded and reproducible on the server",
          "Connectivity is validated before the expedition starts",
        ],
        priority: "mvp",
      }),
      cnt(
        "cnt_rooms",
        "Room templates",
        ["Template", "Role"],
        [
          ["Entrance", "Safe start room"],
          ["Combat arena", "Wave or elite encounter"],
          ["Treasure", "Guaranteed chest"],
          ["Boss arena", "Final encounter"],
        ],
        "level",
      ),
    ],
  ),
  sys(
    "sys_multiplayer",
    "Multiplayer & sessions",
    {
      category: "multiplayer",
      authority: "server",
      priority: "mvp",
      purpose: "Server-authoritative 1–4 player sessions, from lobby to expedition end.",
      parameters: [
        { name: "Server tick", value: "30", unit: "Hz" },
        { name: "Test RTT", value: "80–150", unit: "ms" },
      ],
    },
    [
      mech("mec_party", "Party & ready check", {
        trigger: "Player joins or leaves the party",
        states: ["Lobby", "Ready check", "Expedition start"],
        priority: "mvp",
      }),
      mech("mec_reconnect", "Reconnect & session recovery", {
        trigger: "Connection lost",
        rules: ["A dropped player can rejoin the same session and keep their state"],
        priority: "launch",
      }),
      mech("mec_revive", "Revive", {
        trigger: "Teammate interacts with a downed player",
        priority: "mvp",
      }),
      cnt(
        "cnt_sync",
        "Sync authority",
        ["Data", "Authority", "Synchronization"],
        [
          ["Player movement", "Server", "Input + state snapshots"],
          ["Player HP/Mana", "Server", "State replication"],
          ["Attacks", "Server", "Command + event"],
          ["Cooldowns", "Server", "Authoritative timestamps"],
          ["Enemy AI", "Server", "State snapshots"],
          ["Projectile hits", "Server", "Events / replicated state"],
          ["Inventory", "Server/backend", "Transactional updates"],
          ["Equipment", "Server/backend", "Validated changes"],
          ["VFX / camera shake", "Local client", "Event-driven, cosmetic"],
          ["Quest completion", "Server/backend", "Validated events"],
        ],
      ),
    ],
  ),
  sys(
    "sys_persistence",
    "Persistence & rewards",
    {
      category: "tech",
      authority: "backend",
      priority: "mvp",
      purpose: "Durable characters, items and currency, and safe reward granting.",
      rules: ["Every reward grant is idempotent", "Clients never write persistent state"],
    },
    [
      ent("ent_character", "Character", {
        fields: [
          field("CharacterId", "uuid", { primary: true }),
          field("AccountId", "uuid"),
          field("Name", "string"),
          field("Level", "int"),
          field("Progress", "json"),
        ],
      }),
      ent("ent_reward_grant", "RewardGrant", {
        fields: [
          field("IdempotencyKey", "uuid", { primary: true, unique: true }),
          field("CharacterId", "uuid"),
          field("Payload", "json"),
          field("GrantedAt", "datetime"),
        ],
      }),
      ent("ent_currency_ledger", "CurrencyLedger", {
        fields: [
          field("EntryId", "uuid", { primary: true }),
          field("CharacterId", "uuid"),
          field("Currency", "string"),
          field("Delta", "int"),
          field("CreatedAt", "datetime"),
        ],
      }),
      mech("mec_reward_tx", "Reward grant transaction", {
        trigger: "Expedition completed",
        states: ["Check idempotency key", "Apply XP, currency and items", "Write ledger", "Commit"],
        rules: ["One database transaction per grant; a repeated key is a no-op"],
        priority: "mvp",
      }),
    ],
  ),
  sys("sys_telemetry", "Telemetry", {
    category: "meta",
    authority: "backend",
    priority: "launch",
    purpose: "Metrics to balance and operate the game.",
    rules: [
      "Track expedition completion rate and duration",
      "Track time to kill and player deaths per encounter",
      "Track drop rates per rarity and item usage",
      "Track dodge usage and damage taken per source",
      "Track disconnects and server tick time",
    ],
  }),
];

// ── Layout ──────────────────────────────────────────────────────────────────

const GRID_COLS = 3;
const GAP = 80;
const laid: NodeIn[] = [];
{
  let y = 0;
  for (let r = 0; r * GRID_COLS < systems.length; r++) {
    const row = systems.slice(r * GRID_COLS, (r + 1) * GRID_COLS);
    let x = 0;
    let rowHeight = 0;
    for (const spec of row) {
      const l = layoutSystem(spec, { x, y });
      laid.push(l.node, ...l.children);
      x += l.size.width + GAP;
      rowHeight = Math.max(rowHeight, l.size.height);
    }
    y += rowHeight + GAP;
  }
}
const techY = Math.ceil(
  Math.max(
    ...laid
      .filter((n) => n.kind === "system")
      .map((n) => (n.position?.y ?? 0) + (n.size?.height ?? 0)),
  ) + GAP,
);

const nodes: NodeIn[] = [
  {
    id: "act_player",
    kind: "actor",
    name: "Player",
    position: { x: -400, y: -140 },
    data: {
      type: "human",
      goals: ["Master combat and build a character", "Complete expeditions with friends"],
    },
  },
  loop("lop_combat", "Combat loop", 0, {
    duration: "5–30 seconds",
    motivation: "Mastery: reading telegraphs and executing abilities feels good.",
    steps: ["Spot enemy and telegraph", "Execute abilities", "Dodge", "Defeat enemies"],
  }),
  loop("lop_expedition", "Expedition loop", 120, {
    duration: "15–30 minutes",
    motivation: "Progress through a run toward a boss and loot.",
    steps: ["Enter expedition", "Clear rooms and objectives", "Collect loot", "Defeat the boss"],
  }),
  loop("lop_progression", "Progression loop", 240, {
    duration: "Hours to weeks",
    motivation: "Growth: new builds, new regions and mastery.",
    steps: ["Equip loot and refine build", "Unlock regions", "Gain mastery"],
  }),
  ...laid,
  {
    id: "svc_client",
    kind: "service",
    name: "Unity client",
    position: { x: 0, y: techY },
    size: { width: 360, height: 160 },
    data: {
      type: "desktop",
      language: "C#",
      framework: "Unity 6",
      path: "Assets/Game",
      responsibilities: ["Input, camera, presentation and prediction"],
    },
  },
  {
    id: "svc_server",
    kind: "service",
    name: "Dedicated game server",
    position: { x: 440, y: techY },
    size: { width: 360, height: 160 },
    data: {
      type: "worker",
      language: "C#",
      framework: "Unity 6 (headless)",
      path: "Assets/Game (server build)",
      responsibilities: ["Authoritative simulation at 30 Hz", "AI, damage, drops"],
    },
  },
  {
    id: "svc_backend",
    kind: "service",
    name: "Backend API",
    position: { x: 880, y: techY },
    size: { width: 360, height: 160 },
    data: {
      type: "api",
      language: "C#",
      framework: "ASP.NET Core",
      path: "backend",
      responsibilities: ["Accounts, characters, inventory", "Idempotent reward grants"],
    },
  },
  {
    id: "ds_game",
    kind: "datastore",
    name: "Game database",
    position: { x: 1320, y: techY },
    size: { width: 360, height: 160 },
    data: { engine: "postgres", version: "18", purpose: "Accounts, characters, items, ledger" },
  },
  {
    id: "ent_account",
    kind: "entity",
    name: "Account",
    parentId: "ds_game",
    position: { x: 24, y: 60 },
    data: {
      fields: [
        field("AccountId", "uuid", { primary: true }),
        field("DisplayName", "string"),
        field("CreatedAt", "datetime"),
      ],
    },
  },
];

// ── Edges ───────────────────────────────────────────────────────────────────

let edgeCount = 0;
const e = (kind: EdgeIn["kind"], source: string, target: string, label = ""): EdgeIn => {
  const id = `e_${String(++edgeCount).padStart(2, "0")}`;
  const base = { id, source, target, label };
  switch (kind) {
    case "produces":
      return { ...base, kind, data: { rate: label } };
    case "consumes":
      return { ...base, kind, data: { amount: label } };
    case "triggers":
      return { ...base, kind, data: { event: label } };
    case "modifies":
      return { ...base, kind, data: { effect: label } };
    case "interacts":
      return { ...base, kind, data: { via: label } };
    case "calls":
      return { ...base, kind, data: { protocol: label === "Unity Transport" ? "other" : "http" } };
    case "accesses":
      return { ...base, kind, data: { mode: "read-write" } };
    default:
      return { ...base, kind } as EdgeIn;
  }
};

const edges: EdgeIn[] = [
  e("interacts", "act_player", "lop_combat", "keyboard & mouse / controller"),
  e("interacts", "act_player", "svc_client", "PC"),
  e("drives", "lop_progression", "lop_expedition"),
  e("drives", "lop_expedition", "lop_combat"),
  e("drives", "lop_combat", "sys_combat"),
  e("drives", "lop_expedition", "sys_dungeons"),
  e("drives", "lop_expedition", "sys_loot"),
  e("drives", "lop_progression", "sys_progression"),
  e("drives", "lop_progression", "sys_economy"),
  e("consumes", "mec_dodge", "res_stamina", "25 per dodge"),
  e("consumes", "mec_skill_exec", "res_mana", "skill cost"),
  e("consumes", "mec_damage", "res_health", "final damage"),
  e("produces", "sys_character", "res_stamina", "20/s after delay"),
  e("produces", "sys_enemies", "res_xp", "on kill"),
  e("produces", "sys_loot", "res_gold", "gold drops"),
  e("produces", "sys_loot", "res_materials", "material drops"),
  e("produces", "sys_bosses", "res_essence", "on boss defeat"),
  e("produces", "sys_dungeons", "res_mastery_tokens", "on expedition completion"),
  e("produces", "mec_crafting", "res_essence", "dismantle"),
  e("consumes", "mec_crafting", "res_gold", "upgrade and reroll"),
  e("consumes", "mec_crafting", "res_essence", "upgrade and reroll"),
  e("consumes", "mec_crafting", "res_materials", "upgrade"),
  e("consumes", "mec_leveling", "res_xp", "per level threshold"),
  e("consumes", "sys_progression", "res_mastery_tokens", "mastery unlocks"),
  e("triggers", "sys_combat", "sys_loot", "enemy defeated"),
  e("triggers", "sys_bosses", "sys_loot", "boss defeated"),
  e("triggers", "sys_loot", "sys_inventory", "item granted"),
  e("triggers", "sys_dungeons", "sys_persistence", "expedition completed"),
  e("triggers", "mec_personal_loot", "mec_reward_tx", "loot rolled"),
  e("modifies", "sys_inventory", "sys_character", "+stats from gear"),
  e("modifies", "cnt_attributes", "mec_damage", "S, F and M inputs"),
  e("modifies", "cnt_difficulty", "sys_enemies", "HP and damage by player count"),
  e("modifies", "mec_mastery", "sys_abilities", "unlocks skill branches"),
  e("modifies", "mec_leveling", "sys_character", "attribute points"),
  e("modifies", "cnt_legendary", "sys_abilities", "alters skill behaviour"),
  e("depends_on", "sys_combat", "sys_character"),
  e("depends_on", "sys_combat", "sys_multiplayer"),
  e("depends_on", "sys_abilities", "sys_combat"),
  e("depends_on", "sys_enemies", "sys_combat"),
  e("depends_on", "sys_bosses", "sys_enemies"),
  e("depends_on", "sys_dungeons", "sys_enemies"),
  e("depends_on", "sys_loot", "sys_inventory"),
  e("depends_on", "sys_persistence", "sys_inventory"),
  e("depends_on", "sys_economy", "sys_inventory"),
  e("depends_on", "sys_economy", "sys_persistence"),
  e("depends_on", "sys_progression", "sys_character"),
  e("uses", "sys_loot", "cnt_rarity", "rarity and modifier rolls"),
  e("uses", "mec_personal_loot", "cnt_legendary", "legendary effect pool"),
  e("uses", "sys_enemies", "cnt_enemy_archetypes", "behaviour definitions"),
  e("uses", "sys_bosses", "cnt_guardian_phases", "phase definitions"),
  e("uses", "sys_dungeons", "cnt_rooms", "room pool"),
  e("uses", "mec_equip", "cnt_slots", "slot rules"),
  e("uses", "sys_multiplayer", "cnt_sync", "authority table"),
  e("uses", "sys_combat", "cnt_controls", "input bindings"),
  e("uses", "sys_character", "cnt_archetypes", "weapon families"),
  e("accesses", "sys_persistence", "ds_game"),
  e("accesses", "mec_reward_tx", "ent_reward_grant"),
  e("calls", "svc_client", "svc_server", "Unity Transport"),
  e("calls", "svc_server", "svc_backend", "reward grants"),
  e("accesses", "svc_backend", "ds_game"),
];

// ── Document ────────────────────────────────────────────────────────────────

export const ashenRealmsDesign: DesignDocumentInput = {
  schemaVersion: 1,
  overview: {
    mode: "game",
    summary:
      "Ashen Realms is a dark-fantasy top-down action RPG for 1–4 players. Players explore " +
      "regions, fight enemies, collect equipment, build specialised characters and defeat " +
      "bosses together.",
    goals: [
      "Enjoyable solo; co-op creates tactical possibilities rather than just more enemy HP",
      "Reward both player skill and build choices",
      "Multiplayer from day one",
    ],
    nonGoals: [
      "Open-world MMO",
      "PvP",
      "Player trading at launch",
      "Fully procedural level geometry",
    ],
    architectureStyle: "modular-monolith",
    architectureNotes:
      "Game logic is pure C# domain code with thin Unity MonoBehaviour adapters. Multiplayer is " +
      "server-authoritative. The backend is a modular monolith plus one dedicated game-server " +
      "executable.",
    repository: {
      layout: "single-package",
      notes:
        "Unity project with Assets/Game/{Core,Features,Content,Presentation,Networking,Scenes,Tests}. " +
        "Each feature has its own assembly definition.",
    },
    game: {
      genre: "Top-down action RPG",
      engine: "Unity 6",
      platforms: ["PC"],
      pillars: [
        "Solo-enjoyable; co-op adds tactics",
        "Equipment enables strategies but never replaces skill",
        "Readable telegraphs",
        "Difficulty from behaviour, not stat inflation",
      ],
      parameters: [
        { name: "Players", value: "1–4 online" },
        { name: "Camera", value: "Top-down 3D" },
        { name: "Combat", value: "Real-time action" },
        { name: "Session", value: "15–30 minutes" },
        { name: "Progression", value: "Persistent characters" },
        { name: "Monetization", value: "Premium / cosmetics" },
        { name: "World", value: "Hub + instances" },
        { name: "Networking", value: "Server-authoritative" },
      ],
      references: [
        { name: "Diablo", takeaway: "Loot, equipment and build optimisation" },
        { name: "Hades", takeaway: "Responsive combat, telegraphs and abilities" },
        { name: "V Rising", takeaway: "Top-down movement and skill-based co-op" },
        { name: "Monster Hunter", takeaway: "Boss mechanics, materials and crafting" },
      ],
      targets: [
        { name: "Client FPS", value: "60", unit: "FPS" },
        { name: "Server simulation", value: "30", unit: "Hz" },
        { name: "Players per session", value: "4" },
        { name: "RTT playability", value: "150", unit: "ms" },
      ],
    },
  },
  stack: [
    { id: "stk_unity", category: "framework", name: "Unity", version: "6" },
    { id: "stk_csharp", category: "language", name: "C#" },
    { id: "stk_urp", category: "ui", name: "Universal Render Pipeline (URP)" },
    { id: "stk_input", category: "library", name: "Input System" },
    { id: "stk_cinemachine", category: "library", name: "Cinemachine" },
    { id: "stk_addressables", category: "library", name: "Addressables" },
    {
      id: "stk_ngo",
      category: "messaging",
      name: "Netcode for GameObjects + Unity Transport",
    },
    { id: "stk_navmesh", category: "library", name: "AI Navigation (NavMesh)" },
    { id: "stk_so", category: "other", name: "ScriptableObjects", notes: "Content definitions" },
    {
      id: "stk_aspnet",
      category: "framework",
      name: "ASP.NET Core",
      scope: ["svc_backend"],
    },
    { id: "stk_pg", category: "database", name: "PostgreSQL", version: "18" },
    { id: "stk_redis", category: "cache", name: "Redis", notes: "Only when needed" },
    { id: "stk_linux", category: "hosting", name: "Linux dedicated server build" },
  ],
  conventions: [
    {
      id: "cnv_pure_domain",
      category: "testing",
      level: "must",
      rule:
        "Damage and other combat math live in deterministic pure C# domain services with " +
        "EditMode tests.",
      scope: ["sys_combat"],
    },
    {
      id: "cnv_server_owns",
      category: "security",
      level: "must",
      rule: "The server owns health, damage, cooldowns, AI, drops and rewards.",
    },
    {
      id: "cnv_idempotent",
      category: "error-handling",
      level: "must",
      rule: "Every reward grant carries an idempotency key.",
      scope: ["sys_persistence"],
    },
    {
      id: "cnv_no_client_amounts",
      category: "security",
      level: "must",
      rule: "Clients never submit their own XP, currency or loot amounts.",
    },
    {
      id: "cnv_stable_ids",
      category: "structure",
      level: "must",
      rule: "Content definitions are ScriptableObjects with stable ids.",
    },
    {
      id: "cnv_asmdef",
      category: "structure",
      level: "should",
      rule: "Each feature has its own assembly definition.",
    },
    {
      id: "cnv_vfx",
      category: "performance",
      level: "should",
      rule: "No networked GameObject per VFX particle; replicate events, not effects.",
    },
  ],
  decisions: [
    {
      id: "adr_hub_instances",
      title: "Hub plus instanced dungeons",
      decision: "A social hub and instanced expeditions, not an open world.",
      consequences: "Smaller scope and simpler authority; sessions are short and replayable.",
      date: "2026-10-11",
    },
    {
      id: "adr_weapon_builds",
      title: "Weapon-driven flexible builds",
      decision: "Weapons define skills; attributes and gear refine the build.",
      consequences: "Builds are flexible without rigid classes.",
      date: "2026-10-11",
    },
    {
      id: "adr_personal_loot",
      title: "Personal, server-generated loot",
      decision: "Each player gets independent loot rolled on the server.",
      consequences: "No loot contention; the server can be audited for drops.",
      date: "2026-10-11",
    },
    {
      id: "adr_server_authority",
      title: "Server-authoritative multiplayer",
      decision: "The dedicated server simulates combat; clients predict and reconcile.",
      consequences: "Cheating is hard; requires prediction work for responsive combat.",
      date: "2026-10-11",
    },
    {
      id: "adr_ngo",
      title: "Netcode for GameObjects initially",
      decision: "Start with NGO and Unity Transport behind a networking abstraction.",
      consequences: "Fast start; the transport can be replaced later.",
      date: "2026-10-11",
    },
    {
      id: "adr_aspnet_pg",
      title: "ASP.NET Core and PostgreSQL for persistence",
      decision: "A modular-monolith backend with PostgreSQL stores accounts and characters.",
      consequences: "One language across the stack; transactional reward grants.",
      date: "2026-10-11",
    },
    {
      id: "adr_scriptable_content",
      title: "ScriptableObject content",
      decision: "Items, enemies, skills and rooms are ScriptableObject assets with stable ids.",
      consequences: "Designers tune without code; ids keep saves compatible.",
      date: "2026-10-11",
    },
    {
      id: "adr_pure_domain",
      title: "Pure C# domain with Unity adapters",
      decision: "Game rules are plain C#; MonoBehaviours only adapt them to the engine.",
      consequences: "Rules are unit-testable in EditMode and reusable on client and server.",
      date: "2026-10-11",
    },
    {
      id: "adr_no_trading",
      title: "No player trading at launch",
      decision: "Items are bound to the character that receives them.",
      consequences: "Avoids duplication exploits and RMT early on.",
      date: "2026-10-11",
    },
    {
      id: "adr_authored_rooms",
      title: "Authored rooms, random assembly",
      decision: "Hand-built room prefabs assembled from a server-side seed.",
      consequences: "Quality control per room with replayable variety.",
      date: "2026-10-11",
    },
    {
      id: "adr_mp_prototype",
      title: "Multiplayer prototype from day one",
      decision: "The first milestone runs two clients against a server.",
      consequences: "Networking constraints shape every system from the start.",
      date: "2026-10-11",
    },
  ],
  milestones: [
    {
      id: "ms_foundation",
      title: "Foundation",
      timeframe: "Weeks 1–3",
      deliverables: [
        "Unity setup",
        "Input",
        "Camera",
        "Movement",
        "Networking skeleton",
        "Server / client testing",
      ],
      exitCriteria: "Two clients move independently in one arena.",
      scope: ["sys_multiplayer", "sys_character"],
    },
    {
      id: "ms_combat",
      title: "Combat",
      timeframe: "Weeks 4–7",
      deliverables: [
        "Attack phases and dodge",
        "Damage calculation",
        "First enemies with telegraphs",
        "Latency simulation tooling",
      ],
      exitCriteria: "Combat feels responsive under simulated latency.",
      scope: ["sys_combat", "sys_abilities", "sys_enemies"],
    },
    {
      id: "ms_rpg",
      title: "RPG Systems",
      timeframe: "Weeks 8–11",
      deliverables: ["Inventory and equipment", "Personal loot", "Attributes", "Leveling"],
      exitCriteria: "Loot can be earned, equipped and changes combat.",
      scope: ["sys_inventory", "sys_loot", "sys_progression"],
    },
    {
      id: "ms_coop",
      title: "Co-op Gameplay",
      timeframe: "Weeks 12–15",
      deliverables: ["Party and ready check", "Seeded dungeons", "Hollow Guardian boss", "Revive"],
      exitCriteria: "Four players complete an expedition.",
      scope: ["sys_dungeons", "sys_bosses", "sys_multiplayer"],
    },
    {
      id: "ms_persistence",
      title: "Persistence & Economy",
      timeframe: "Weeks 16–19",
      deliverables: [
        "Backend API and database",
        "Idempotent reward grants",
        "Crafting and currencies",
      ],
      exitCriteria: "Characters retain progress safely between sessions.",
      scope: ["sys_persistence", "sys_economy"],
    },
    {
      id: "ms_polish",
      title: "Content & Polish",
      timeframe: "Weeks 20–24",
      deliverables: ["Content pass", "Balancing from telemetry", "Reconnect", "Performance pass"],
      exitCriteria: "Stable, replayable 15–30 minute gameplay loop.",
      scope: ["sys_telemetry"],
    },
  ],
  nodes,
  edges,
};
